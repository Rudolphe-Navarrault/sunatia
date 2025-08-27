// events/interactionCreate.js
const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction, client) {
    // --- Middleware : mise à jour de la dernière activité ---
    if (interaction.inGuild() && interaction.user && !interaction.user.bot) {
      try {
        const UserModel = client.database?.models?.User;
        if (UserModel?.updateLastActivity) {
          await UserModel.updateLastActivity(interaction.user.id, interaction.guildId);
        } else {
          logger.warn("Le modèle User n'est pas disponible pour updateLastActivity");
        }
      } catch (err) {
        logger.error('Erreur lors de la mise à jour de la dernière activité:', err);
      }
    }

    // --- Fonction de gestion des erreurs ---
    const handleError = async (
      err,
      msg = "Une erreur est survenue lors du traitement de l'interaction."
    ) => {
      logger.error(msg, err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `❌ ${msg}`, ephemeral: true }).catch(() => {});
      } else if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ ${msg}` }).catch(() => {});
      }
    };

    try {
      // --- Gestion des boutons ---
      if (interaction.isButton()) {
        const [type, action, ...params] = interaction.customId.split('_');
        const handler = client.interactionHandlers?.buttons?.[type];
        if (handler) {
          try {
            return await handler(interaction, action, ...params);
          } catch (err) {
            return handleError(err, `Erreur lors du traitement du bouton "${type}"`);
          }
        } else {
          logger.warn(`Aucun handler pour le bouton de type "${type}"`);
          return;
        }
      }

      // --- Gestion des commandes slash ---
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          logger.warn(`Commande inconnue: ${interaction.commandName}`);
          return interaction
            .reply({ content: "❌ Cette commande n'existe pas.", ephemeral: true })
            .catch(() => {});
        }

        logger.info(`Commande "${interaction.commandName}" exécutée par ${interaction.user.tag}`);

        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply().catch(() => {});
        }

        try {
          return await command.execute(interaction, client);
        } catch (err) {
          return handleError(
            err,
            `Erreur lors de l'exécution de la commande "${interaction.commandName}"`
          );
        }
      }

      // --- Gestion de l’autocomplétion ---
      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command?.autocomplete) {
          logger.warn(`Pas d'autocomplétion pour ${interaction.commandName}`);
          return;
        }
        try {
          return await command.autocomplete(interaction, client);
        } catch (err) {
          return handleError(
            err,
            `Erreur lors de l'autocomplétion de "${interaction.commandName}"`
          );
        }
      }
    } catch (err) {
      await handleError(err);
    }
  },
};
