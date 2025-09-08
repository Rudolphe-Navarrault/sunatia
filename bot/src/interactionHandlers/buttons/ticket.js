const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Ticket = require('../../models/Ticket');
const TicketConfig = require('../../models/TicketConfig');

module.exports = async (interaction) => {
  const { guild, member, customId } = interaction;

  const config = await TicketConfig.findOne({ guildId: guild.id });
  if (!config) {
    return interaction.reply({
      content: "⚠️ Le système de tickets n'est pas configuré.",
      ephemeral: true,
    });
  }

  // --- Menu dropdown ---
  if (interaction.isStringSelectMenu() && customId === 'ticket_reason') {
    const reason = interaction.values[0];
    interaction.client.tempTicketReason = reason;
    return interaction.reply({
      content: `✅ Raison sélectionnée : **${reason}**`,
      ephemeral: true,
    });
  }

  // --- Bouton création ---
  if (interaction.isButton() && customId === 'ticket_create') {
    const reason = interaction.client.tempTicketReason || 'Non spécifiée';

    // Vérifier si déjà un ticket
    const existing = await Ticket.findOne({
      guildId: guild.id,
      userId: member.id,
      status: { $ne: 'closed' },
    });
    if (existing) {
      return interaction.reply({ content: '❌ Vous avez déjà un ticket ouvert.', ephemeral: true });
    }

    const category = guild.channels.cache.get(config.categoryId);
    if (!category) {
      return interaction.reply({ content: '❌ Catégorie introuvable.', ephemeral: true });
    }

    const ticketChannel = await guild.channels.create({
      name: `ticket-${member.user.username}`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: member.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        { id: config.staffRoleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      ],
    });

    await Ticket.create({
      guildId: guild.id,
      channelId: ticketChannel.id,
      userId: member.id,
      reason,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('🔒 Fermer')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ticket_pause')
        .setLabel('⏸️ Pause')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ticket_resume')
        .setLabel('▶️ Reprendre')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ticket_archive')
        .setLabel('📦 Archiver')
        .setStyle(ButtonStyle.Primary)
    );

    await ticketChannel.send({
      content: `🎫 **Ticket ouvert par ${member.user.tag}**\nRaison : **${reason}**\n\nUn membre du staff (<@&${config.staffRoleId}>) va bientôt vous répondre.`,
      components: [row],
    });

    return interaction.reply({ content: `✅ Ticket créé : ${ticketChannel}`, ephemeral: true });
  }

  // --- Boutons dans le ticket ---
  if (interaction.isButton() && customId.startsWith('ticket_')) {
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
    if (!ticket)
      return interaction.reply({ content: '❌ Ce salon n’est pas un ticket.', ephemeral: true });

    if (customId === 'ticket_close') {
      ticket.status = 'closed';
      await ticket.save();

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_cancelclose')
          .setLabel('❌ Annuler fermeture')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.channel.send({
        content: '🔒 Ticket fermé. Suppression dans 1 minute...',
        components: [confirmRow],
      });

      const timeout = setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 60 * 1000);

      interaction.client.ticketTimeouts = interaction.client.ticketTimeouts || {};
      interaction.client.ticketTimeouts[interaction.channel.id] = timeout;

      return interaction.reply({ content: '✅ Fermeture programmée.', ephemeral: true });
    }

    if (customId === 'ticket_cancelclose') {
      const timeout = interaction.client.ticketTimeouts?.[interaction.channel.id];
      if (timeout) {
        clearTimeout(timeout);
        delete interaction.client.ticketTimeouts[interaction.channel.id];
        ticket.status = 'open';
        await ticket.save();
        return interaction.reply({ content: '❌ Fermeture annulée.', ephemeral: true });
      }
    }

    if (customId === 'ticket_pause') {
      ticket.status = 'paused';
      await ticket.save();
      return interaction.reply({ content: '⏸️ Ticket en pause.', ephemeral: true });
    }

    if (customId === 'ticket_resume') {
      ticket.status = 'open';
      await ticket.save();
      return interaction.reply({ content: '▶️ Ticket repris.', ephemeral: true });
    }

    if (customId === 'ticket_archive') {
      ticket.status = 'closed';
      await ticket.save();

      await interaction.reply({ content: '📦 Ticket archivé (non supprimé).', ephemeral: true });
      return;
    }
  }
};
