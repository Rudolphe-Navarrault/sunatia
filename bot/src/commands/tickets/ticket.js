const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const Ticket = require('../../models/Ticket');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Gestion des tickets')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Créer un nouveau ticket')
        .addStringOption((opt) =>
          opt.setName('reason').setDescription('Raison du ticket').setRequired(false)
        )
    )
    .addSubcommand((sub) => sub.setName('close').setDescription('Fermer ce ticket'))
    .addSubcommand((sub) => sub.setName('pause').setDescription('Mettre le ticket en pause'))
    .addSubcommand((sub) => sub.setName('resume').setDescription('Reprendre un ticket en pause'))
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Ajouter un utilisateur au ticket')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur à ajouter').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Retirer un utilisateur du ticket')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur à retirer').setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const channel = interaction.channel;
    const member = interaction.member;

    try {
      // --- CREATE ---
      if (sub === 'create') {
        const reason = interaction.options.getString('reason') || 'Aucune raison fournie';
        const existing = await Ticket.findOne({
          guildId: guild.id,
          userId: member.id,
          status: 'open',
        });
        if (existing)
          return interaction.reply({
            content: '❌ Vous avez déjà un ticket ouvert.',
            ephemeral: true,
          });

        const category = guild.channels.cache.find(
          (c) => c.name.toLowerCase().includes('tickets') && c.type === 4
        );
        const ticketChannel = await guild.channels.create({
          name: `ticket-${member.user.username}`,
          type: 0,
          parent: category?.id || null,
          permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
            { id: member.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
          ],
        });

        await Ticket.create({
          guildId: guild.id,
          channelId: ticketChannel.id,
          userId: member.id,
          status: 'open',
          reason,
        });
        return interaction.reply({ content: `✅ Ticket créé : ${ticketChannel}`, ephemeral: true });
      }

      // --- CHECK TICKET ---
      const ticket = await Ticket.findOne({ channelId: channel.id });
      if (!ticket)
        return interaction.reply({ content: '❌ Ce salon n’est pas un ticket.', ephemeral: true });

      // --- CLOSE ---
      if (sub === 'close') {
        if (ticket.status === 'closed')
          return interaction.reply({ content: '✅ Ce ticket est déjà fermé.', ephemeral: true });

        ticket.status = 'closed';
        await ticket.save();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('cancel_close')
            .setLabel('Annuler la fermeture')
            .setStyle(ButtonStyle.Danger)
        );

        const msg = await channel.send({
          content:
            '🔒 Ce ticket sera fermé et supprimé dans 1 minute. Cliquez sur "Annuler la fermeture" si nécessaire.',
          components: [row],
        });

        const timeout = setTimeout(async () => {
          try {
            await channel.delete('Ticket fermé automatiquement');
            await Ticket.deleteOne({ channelId: channel.id });
          } catch (err) {
            console.error('Erreur lors de la suppression automatique du salon :', err);
          }
        }, 60_000);

        const filter = (i) => i.customId === 'cancel_close' && i.user.id === ticket.userId;
        const collector = msg.createMessageComponentCollector({ filter, time: 60_000 });

        collector.on('collect', async (i) => {
          clearTimeout(timeout);
          ticket.status = 'open';
          await ticket.save();
          await i.update({
            content: '✅ Fermeture annulée. Le ticket reste ouvert.',
            components: [],
          });
        });

        collector.on('end', async () => {
          try {
            if (!channel.deleted) await msg.edit({ components: [] });
          } catch (err) {
            console.error(err);
          }
        });

        return interaction.reply({
          content: '✅ Ticket en cours de fermeture...',
          ephemeral: true,
        });
      }

      // --- PAUSE ---
      if (sub === 'pause') {
        if (ticket.status === 'paused')
          return interaction.reply({ content: '⚠️ Ticket déjà en pause.', ephemeral: true });
        ticket.status = 'paused';
        await ticket.save();
        return interaction.reply({ content: '⏸️ Ticket mis en pause.', ephemeral: true });
      }

      // --- RESUME ---
      if (sub === 'resume') {
        if (ticket.status !== 'paused')
          return interaction.reply({ content: '⚠️ Ticket n’est pas en pause.', ephemeral: true });
        ticket.status = 'open';
        await ticket.save();
        return interaction.reply({ content: '▶️ Ticket repris.', ephemeral: true });
      }

      // --- ADD USER ---
      if (sub === 'add') {
        const user = interaction.options.getUser('user');
        if (!user)
          return interaction.reply({ content: '❌ Utilisateur invalide.', ephemeral: true });
        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        return interaction.reply({ content: `✅ ${user.tag} ajouté au ticket.`, ephemeral: true });
      }

      // --- REMOVE USER ---
      if (sub === 'remove') {
        const user = interaction.options.getUser('user');
        if (!user)
          return interaction.reply({ content: '❌ Utilisateur invalide.', ephemeral: true });
        await channel.permissionOverwrites.delete(user.id);
        return interaction.reply({ content: `✅ ${user.tag} retiré du ticket.`, ephemeral: true });
      }
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
    }
  },
};
