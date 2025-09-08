const { Events } = require('discord.js');
const logger = require('../utils/logger');
const { ensureUser } = require('../middleware/userMiddleware');

module.exports = {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction, client) {
    await ensureUser(interaction, client);

    const handleError = async (err, msg = 'Une erreur est survenue.') => {
      if (err?.code === 10062 || err?.code === 40060) return; // ignore certains codes
      logger.error(msg, err);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ ${msg}`, flags: 1 << 6 }); // ephemeral
        } else if (interaction.deferred) {
          await interaction.editReply({ content: `❌ ${msg}`, flags: 1 << 6 });
        }
      } catch {}
    };

    try {
      // --- BOUTONS & MENUS ---
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const action = interaction.customId; // ex: "rps_pierre" ou "ticket_close"
        const handlerName = action.split('_')[0]; // récupère "rps", "ticket", etc.

        const handler = client.interactionHandlers?.buttons?.[handlerName];
        if (!handler) return; // pas de handler => ignore

        try {
          // Si le handler est un objet avec "execute", on l'appelle
          if (handler.execute) await handler.execute(interaction, action, client);
          // Sinon, si c’est directement une fonction
          else await handler(interaction, action, client);
        } catch (err) {
          return handleError(err, `Erreur sur le bouton ${action}`);
        }
      }

      // --- SLASH COMMANDS ---
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return handleError('Commande introuvable');

        const allowed = await client.hasCommandPermission(
          interaction.user.id,
          interaction.commandName,
          interaction.guild.id
        );
        if (!allowed) {
          return interaction.reply({ content: '❌ Pas la permission.', flags: 1 << 6 });
        }

        try {
          await command.execute(interaction, client);
        } catch (err) {
          return handleError(err, `Erreur commande ${interaction.commandName}`);
        }
      }

      // --- AUTOCOMPLETION ---
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
