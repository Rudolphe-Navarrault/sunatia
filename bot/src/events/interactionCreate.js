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
      // Ne pas logger les erreurs d'interaction déjà traitée ou expirée
      if (err.code === 10062 || err.code === 40060) return;

      logger.error(msg, err);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `❌ ${msg}`,
            flags: 1 << 6,
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: `❌ ${msg}`,
            flags: 1 << 6,
          });
        }
      } catch (replyError) {
        // Ne rien faire si l'échec est dû à une interaction déjà traitée
        if (replyError.code !== 10062 && replyError.code !== 40060) {
          logger.error("Échec de l'envoi du message d'erreur:", replyError);
        }
      }
    };

    try {
      // --- Gestion des composants d'interaction ---
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        // Gestion des boutons et menus déroulants de la commande help
        if (interaction.customId.startsWith('help_') || interaction.customId === 'help_category') {
          // Ne pas traiter les interactions déjà répondues
          if (interaction.replied || interaction.deferred) {
            logger.debug('Interaction déjà traitée, ignorée:', interaction.id);
            return;
          }

          try {
            // Récupérer la commande help
            const command = client.commands.get('help');
            if (!command || !command.execute) {
              logger.warn('Commande help non trouvée ou non exécutable');
              return interaction.reply({ 
                content: '❌ La commande d\'aide n\'est pas disponible pour le moment.', 
                ephemeral: true 
              }).catch(() => {});
            }
            
            // Vérifier si l'interaction est toujours valide
            if (!interaction.isMessageComponent()) {
              return interaction.reply({ 
                content: '❌ Cette interaction n\'est plus valide.', 
                ephemeral: true 
              }).catch(() => {});
            }
            
            // Différer la réponse pour gérer l'interaction de manière asynchrone
            try {
              await interaction.deferUpdate();
            } catch (deferError) {
              // Si l'interaction a déjà été traitée, on l'ignore
              if (deferError.code === 10062) return;
              throw deferError;
            }
            
            // Exécuter la commande help avec l'interaction
            try {
              await command.execute(interaction);
            } catch (executeError) {
              logger.error('Erreur lors de l\'exécution de la commande help:', executeError);
              // Essayer d'envoyer un message d'erreur si possible
              if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                  content: '❌ Une erreur est survenue lors du traitement de votre demande.', 
                  ephemeral: true 
                }).catch(() => {});
              } else {
                await interaction.editReply({ 
                  content: '❌ Une erreur est survenue lors du traitement de votre demande.'
                }).catch(() => {});
              }
            }
            
          } catch (error) {
            logger.error('Erreur critique dans le gestionnaire d\'aide:', error);
            // Ne pas propager l'erreur pour éviter les boucles infinies
            if (!interaction.replied && !interaction.deferred) {
              interaction.reply({ 
                content: '❌ Une erreur critique est survenue.', 
                ephemeral: true 
              }).catch(() => {});
            }
          }
          return;
        }
        
        // Gestion des autres boutons personnalisés
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
      }

      // --- Gestion des commandes slash ---
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          logger.warn(`Commande inconnue: ${interaction.commandName}`);
          if (!interaction.replied && !interaction.deferred) {
            return interaction
              .reply({
                content: "❌ Cette commande n'existe pas.",
                flags: 1 << 6, // Éphémère
              })
              .catch(() => {});
          }
          return;
        }

        logger.info(`Commande "${interaction.commandName}" exécutée par ${interaction.user.tag}`);

        // Ne pas différer ici, la commande s'en charge
        try {
          return await command.execute(interaction, client);
        } catch (err) {
          // Ignorer silencieusement si interaction déjà expirée
          if (err.code === 10062 || err.code === 40060) {
            logger.warn(`Interaction expirée ou déjà traitée pour ${interaction.commandName}`);
            return;
          }

          logger.error(`Erreur dans la commande ${interaction.commandName}:`, err);

          if (!interaction.replied && !interaction.deferred) {
            return interaction
              .reply({
                content: `❌ Une erreur est survenue lors de l'exécution de la commande.`,
                flags: 1 << 6,
              })
              .catch(() => {});
          }
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
