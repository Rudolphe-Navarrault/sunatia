// events/interactionCreate.js
const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const Ticket = require('../models/Ticket');
const TicketSetup = require('../models/TicketSetup');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction, client) {
    try {
      // --- Gestion boutons ---
      if (interaction.isButton()) {
        // --- Création ticket ---
        if (interaction.customId === 'ticket_create') {
          const guild = interaction.guild;
          const member = interaction.member;

          // Vérifier si ticket existant
          const existing = await Ticket.findOne({
            guildId: guild.id,
            userId: member.id,
            status: { $in: ['open', 'paused'] },
          });
          if (existing)
            return interaction.reply({
              content: '❌ Vous avez déjà un ticket ouvert.',
              ephemeral: true,
            });

          // Catégorie ticket
          const category = guild.channels.cache.find(
            (c) => c.name.toLowerCase().includes('tickets') && c.type === 4
          );

          // Raison sélectionnée (dropdown)
          let selectedReason = 'Support général';
          try {
            const setup = await TicketSetup.findOne({ guildId: guild.id });
            if (setup) {
              const msg = await interaction.channel.messages.fetch(setup.messageId);
              const menu = msg.components[0].components[0];
              const value = menu.options.find((opt) => opt.default)?.value;
              if (value) selectedReason = value;
            }
          } catch {}

          // Création channel
          const ticketChannel = await guild.channels.create({
            name: `ticket-${member.user.username}`,
            type: 0,
            parent: category?.id || null,
            permissionOverwrites: [
              { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
              { id: member.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
            ],
          });

          // Sauvegarde DB
          await Ticket.create({
            guildId: guild.id,
            channelId: ticketChannel.id,
            userId: member.id,
            reason: selectedReason,
            status: 'open',
          });

          // Message dans le ticket
          const closeBtn = new ButtonBuilder()
            .setCustomId('ticket_close_confirm')
            .setLabel('🔒 Fermer')
            .setStyle(ButtonStyle.Danger);
          const pauseBtn = new ButtonBuilder()
            .setCustomId('ticket_pause')
            .setLabel('⏸ Pause')
            .setStyle(ButtonStyle.Secondary);
          const resumeBtn = new ButtonBuilder()
            .setCustomId('ticket_resume')
            .setLabel('▶️ Reprendre')
            .setStyle(ButtonStyle.Success);
          const archiveBtn = new ButtonBuilder()
            .setCustomId('ticket_archive')
            .setLabel('📦 Archiver')
            .setStyle(ButtonStyle.Primary);
          const row = new ActionRowBuilder().addComponents(
            closeBtn,
            pauseBtn,
            resumeBtn,
            archiveBtn
          );

          await ticketChannel.send({
            content: `🎫 **Ticket pour ${member.user.tag}**
• Raison : **${selectedReason}**

Merci de patienter, un membre du support va arriver bientôt !  
Veuillez ne pas partager vos informations personnelles.  
Les actions disponibles sont ci-dessous :`,
            components: [row],
          });

          return interaction.reply({
            content: `✅ Ticket créé : ${ticketChannel}`,
            ephemeral: true,
          });
        }

        // --- Actions sur le ticket ---
        const ticket = await Ticket.findOne({ channelId: interaction.channel.id });
        if (!ticket)
          return interaction.reply({
            content: '❌ Ce salon n’est pas un ticket.',
            ephemeral: true,
          });

        if (interaction.customId === 'ticket_close_confirm') {
          ticket.status = 'closed';
          await ticket.save();
          await interaction.reply({
            content: '🔒 Ticket fermé, suppression automatique dans 1 minute...',
            ephemeral: true,
          });

          // Suppression auto
          setTimeout(async () => {
            try {
              await interaction.channel.delete('Ticket fermé automatiquement');
            } catch {}
          }, 60 * 1000);
        }

        if (interaction.customId === 'ticket_pause') {
          ticket.status = 'paused';
          await ticket.save();
          return interaction.reply({ content: '⏸ Ticket mis en pause.', ephemeral: true });
        }

        if (interaction.customId === 'ticket_resume') {
          ticket.status = 'open';
          await ticket.save();
          return interaction.reply({ content: '▶️ Ticket repris.', ephemeral: true });
        }

        if (interaction.customId === 'ticket_archive') {
          ticket.status = 'archived';
          await ticket.save();
          return interaction.reply({ content: '📦 Ticket archivé.', ephemeral: true });
        }
      }

      // --- Menus déroulants ---
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_reason_select') {
          // On peut stocker la sélection dans la DB temporairement si besoin
          return interaction.reply({
            content: `✅ Raison sélectionnée : ${interaction.values[0]}`,
            ephemeral: true,
          });
        }
      }

      // --- Slash commands ---
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command)
          return interaction.reply({ content: '❌ Cette commande n’existe pas.', ephemeral: true });

        try {
          await command.execute(interaction, client);
        } catch (err) {
          logger.error(`Erreur commande ${interaction.commandName} :`, err);
          if (!interaction.replied)
            interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
      }

      // --- Autocompletion ---
      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) await command.autocomplete(interaction, client);
      }
    } catch (err) {
      console.error('Erreur interactionCreate :', err);
      if (!interaction.replied)
        interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
    }
  },
};
