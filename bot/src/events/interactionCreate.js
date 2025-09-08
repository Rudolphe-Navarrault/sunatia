const { Events } = require('discord.js');
const logger = require('../utils/logger');
const { ensureUser } = require('../middleware/userMiddleware');

module.exports = {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction, client) {
    await ensureUser(interaction, client);

    // --- MAJ activité utilisateur ---
    if (interaction.inGuild() && interaction.user && !interaction.user.bot) {
      try {
        const UserModel = client.database?.models?.User;
        if (UserModel?.updateLastActivity) {
          await UserModel.updateLastActivity(interaction.user.id, interaction.guildId);
        }
      } catch (err) {
        logger.error('Erreur mise à jour activité:', err);
      }
    }

    const handleError = async (err, msg = 'Une erreur est survenue.') => {
      if (err.code === 10062 || err.code === 40060) return;
      logger.error(msg, err);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ ${msg}`, ephemeral: true });
        } else if (interaction.deferred) {
          await interaction.editReply({ content: `❌ ${msg}`, ephemeral: true });
        }
      } catch {}
    };

    try {
      // --- Boutons & menus ---
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        // Tickets
        if (
          interaction.customId.startsWith('ticket_') ||
          interaction.customId === 'ticket_reason'
        ) {
          const handler = client.interactionHandlers?.buttons?.ticket;
          if (handler) {
            try {
              return await handler(interaction);
            } catch (err) {
              return handleError(err, 'Erreur bouton ticket');
            }
          }
        }

        // Autres (exemple: help)
        if (interaction.customId.startsWith('help_') || interaction.customId === 'help_category') {
          const command = client.commands.get('help');
          if (!command?.handleButton) {
            return interaction
              .reply({ content: "❌ Commande d'aide non dispo.", ephemeral: true })
              .catch(() => {});
          }
          try {
            return await command.handleButton(interaction);
          } catch (err) {
            return handleError(err, 'Erreur bouton help');
          }
        }
      }

      // --- Slash commands ---
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return handleError('Commande introuvable');

        const allowed = await client.hasCommandPermission(
          interaction.user.id,
          interaction.commandName,
          interaction.guild.id
        );
        if (!allowed) {
          return interaction.reply({ content: '❌ Pas la permission.', ephemeral: true });
        }

        try {
          await command.execute(interaction, client);
        } catch (err) {
          await handleError(err, `Erreur commande ${interaction.commandName}`);
        }
      }

      // --- Autocomplétion ---
      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command?.autocomplete) return;
        try {
          return await command.autocomplete(interaction, client);
        } catch (err) {
          return handleError(err, `Erreur autocomplétion ${interaction.commandName}`);
        }
      }
    } catch (err) {
      await handleError(err);
    }
  },
};
