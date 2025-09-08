const { Events } = require('discord.js');
const logger = require('../utils/logger');
const { ensureUser } = require('../middleware/userMiddleware');

module.exports = {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction, client) {
    await ensureUser(interaction, client);

    // --- MAJ de la dernière activité ---
    if (interaction.inGuild() && interaction.user && !interaction.user.bot) {
      try {
        const UserModel = client.database?.models?.User;
        if (UserModel?.updateLastActivity) {
          await UserModel.updateLastActivity(interaction.user.id, interaction.guildId);
        }
      } catch (err) {
        logger.error('Erreur lors de la mise à jour de la dernière activité:', err);
      }
    }

    // --- Gestion des erreurs uniformisée ---
    const handleError = async (
      err,
      msg = "Une erreur est survenue lors du traitement de l'interaction."
    ) => {
      if (err.code === 10062 || err.code === 40060) return;
      logger.error(msg, err);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ ${msg}`, ephemeral: true });
        } else if (interaction.deferred) {
          await interaction.editReply({ content: `❌ ${msg}`, ephemeral: true });
        }
      } catch (replyError) {
        if (replyError.code !== 10062 && replyError.code !== 40060) {
          logger.error("Échec de l'envoi du message d'erreur:", replyError);
        }
      }
    };

    try {
      // --- Boutons & menus déroulants ---
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('help_') || interaction.customId === 'help_category') {
          const command = client.commands.get('help');
          if (!command || !command.handleButton) {
            return interaction
              .reply({
                content: "❌ La commande d'aide n'est pas disponible pour le moment.",
                ephemeral: true,
              })
              .catch(() => {});
          }

          try {
            await command.handleButton(interaction);
          } catch (error) {
            logger.error('Erreur dans handleButton (help):', error);
            if (!interaction.replied && !interaction.deferred) {
              await interaction
                .reply({
                  content: '❌ Une erreur est survenue lors du traitement de votre action.',
                  ephemeral: true,
                })
                .catch(() => {});
            }
          }
          return;
        }

        // Autres boutons custom
        if (interaction.isButton()) {
          const [type, action, ...params] = interaction.customId.split('_');
          const handler = client.interactionHandlers?.buttons?.[type];
          if (handler) {
            try {
              return await handler(interaction, action, ...params);
            } catch (err) {
              return handleError(err, `Erreur lors du traitement du bouton "${type}"`);
            }
          }
        }
      }

      // --- Slash commands ---
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          return handleError("Cette commande n'existe plus ou n'est pas disponible.");
        }

        // ✅ Vérification des permissions customisées
        const allowed = await client.hasCommandPermission(
          interaction.user.id,
          interaction.commandName,
          interaction.guild.id
        );
        if (!allowed) {
          return interaction.reply({
            content: '❌ Vous n’avez pas la permission pour utiliser cette commande.',
            ephemeral: true,
          });
        }

        try {
          await command.execute(interaction, client);
        } catch (error) {
          await handleError(
            error,
            `Erreur lors de l'exécution de la commande ${interaction.commandName}`
          );
        }
      }

      // --- Menus contextuels ---
      else if (interaction.isUserContextMenuCommand()) {
        const command = client.commands.get(`context:${interaction.commandName}`);
        if (!command) {
          return handleError(
            "Cette commande de menu contextuel n'existe plus ou n'est pas disponible."
          );
        }

        // ✅ Vérification des permissions customisées
        const allowed = await client.hasCommandPermission(
          interaction.user.id,
          interaction.commandName,
          interaction.guild.id
        );
        if (!allowed) {
          return interaction.reply({
            content: '❌ Vous n’avez pas la permission pour utiliser ce menu contextuel.',
            ephemeral: true,
          });
        }

        try {
          await command.execute(interaction, client);
        } catch (error) {
          await handleError(
            error,
            `Erreur lors de l'exécution du menu contextuel ${interaction.commandName}`
          );
        }
      }

      // --- Autocomplétion ---
      if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command?.autocomplete) return;

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
