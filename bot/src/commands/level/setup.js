const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const xpController = require('../../controllers/xpController');
const logger = require('../../utils/logger');

// --- Fonction utilitaire pour répondre en toute sécurité ---
async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply(options).catch(() => {});
    } else {
      return interaction.reply(options).catch(() => {});
    }
  } catch (err) {
    logger.error('Erreur dans safeReply:', err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-leveling')
    .setDescription('Configure le système de niveau sur le serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('channel')
        .setDescription('Définit le salon où les messages de niveau seront envoyés')
        .addChannelOption((option) =>
          option
            .setName('salon')
            .setDescription('Salon pour les messages de niveau')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('message')
        .setDescription('Définit le message de niveau personnalisé')
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('Utilisez {user}, {level}, {xp}')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('xp')
        .setDescription("Configure les paramètres d'XP")
        .addIntegerOption((option) =>
          option
            .setName('min')
            .setDescription('XP minimale par message')
            .setMinValue(1)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('max')
            .setDescription('XP maximale par message')
            .setMinValue(1)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('cooldown')
        .setDescription("Temps d'attente entre chaque gain d'XP (en secondes)")
        .addIntegerOption((option) =>
          option
            .setName('secondes')
            .setDescription('Temps en secondes')
            .setMinValue(5)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('blacklist')
        .setDescription("Gère les canaux et rôles exclus du gain d'XP")
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Action sur la blacklist')
            .setRequired(true)
            .addChoices(
              { name: 'Ajouter un canal', value: 'add_channel' },
              { name: 'Retirer un canal', value: 'remove_channel' },
              { name: 'Ajouter un rôle', value: 'add_role' },
              { name: 'Retirer un rôle', value: 'remove_role' },
              { name: 'Afficher la liste noire', value: 'list' }
            )
        )
        .addChannelOption((option) =>
          option.setName('canal').setDescription('Canal à ajouter/retirer').setRequired(false)
        )
        .addRoleOption((option) =>
          option.setName('role').setDescription('Rôle à ajouter/retirer').setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return safeReply(interaction, {
        content: '❌ Vous devez être administrateur pour utiliser cette commande.',
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    try {
      switch (subcommand) {
        case 'channel': {
          const channel = interaction.options.getChannel('salon');
          await xpController.updateGuildSettings(guildId, { 'leveling.channelId': channel.id });
          const embed = new EmbedBuilder()
            .setColor('#00ff9d')
            .setTitle('✅ Salon de niveau configuré')
            .setDescription(`Les messages de niveau seront envoyés dans ${channel}.`);
          return safeReply(interaction, { embeds: [embed], ephemeral: true });
        }

        case 'message': {
          const message = interaction.options.getString('message');
          await xpController.updateGuildSettings(guildId, { 'leveling.levelUpMessage': message });
          const preview = message
            .replace(/{user}/g, interaction.user.toString())
            .replace(/{level}/g, '5')
            .replace(/{xp}/g, '250');
          const embed = new EmbedBuilder()
            .setColor('#00ff9d')
            .setTitle('✅ Message de niveau configuré')
            .addFields(
              { name: 'Message défini :', value: message },
              { name: 'Aperçu :', value: preview }
            );
          return safeReply(interaction, { embeds: [embed], ephemeral: true });
        }

        case 'xp': {
          const min = interaction.options.getInteger('min');
          const max = interaction.options.getInteger('max');
          if (min > max)
            return safeReply(interaction, {
              content: "❌ L'XP minimale ne peut pas être supérieure à l'XP maximale.",
              ephemeral: true,
            });
          await xpController.updateGuildSettings(guildId, {
            'leveling.xpPerMessage': { min, max },
          });
          const embed = new EmbedBuilder()
            .setColor('#00ff9d')
            .setTitle("✅ Paramètres d'XP mis à jour")
            .setDescription(`Les membres gagneront entre **${min}** et **${max}** XP par message.`);
          return safeReply(interaction, { embeds: [embed], ephemeral: true });
        }

        case 'cooldown': {
          const seconds = interaction.options.getInteger('secondes');
          await xpController.updateGuildSettings(guildId, { 'leveling.cooldown': seconds });
          const embed = new EmbedBuilder()
            .setColor('#00ff9d')
            .setTitle("✅ Temps d'attente mis à jour")
            .setDescription(
              `Les membres devront attendre **${seconds} secondes** entre chaque gain d'XP.`
            );
          return safeReply(interaction, { embeds: [embed], ephemeral: true });
        }

        case 'blacklist': {
          const type = interaction.options.getString('type');
          const channel = interaction.options.getChannel('canal');
          const role = interaction.options.getRole('role');

          switch (type) {
            case 'add_channel':
              if (!channel)
                return safeReply(interaction, {
                  content: '❌ Veuillez spécifier un canal.',
                  ephemeral: true,
                });
              await xpController.updateGuildSettings(guildId, {
                $addToSet: { 'leveling.blacklistedChannels': channel.id },
              });
              return safeReply(interaction, {
                content: `✅ Le canal ${channel} a été ajouté à la liste noire.`,
                ephemeral: true,
              });

            case 'remove_channel':
              if (!channel)
                return safeReply(interaction, {
                  content: '❌ Veuillez spécifier un canal.',
                  ephemeral: true,
                });
              await xpController.updateGuildSettings(guildId, {
                $pull: { 'leveling.blacklistedChannels': channel.id },
              });
              return safeReply(interaction, {
                content: `✅ Le canal ${channel} a été retiré de la liste noire.`,
                ephemeral: true,
              });

            case 'add_role':
              if (!role)
                return safeReply(interaction, {
                  content: '❌ Veuillez spécifier un rôle.',
                  ephemeral: true,
                });
              await xpController.updateGuildSettings(guildId, {
                $addToSet: { 'leveling.blacklistedRoles': role.id },
              });
              return safeReply(interaction, {
                content: `✅ Le rôle ${role} a été ajouté à la liste noire.`,
                ephemeral: true,
              });

            case 'remove_role':
              if (!role)
                return safeReply(interaction, {
                  content: '❌ Veuillez spécifier un rôle.',
                  ephemeral: true,
                });
              await xpController.updateGuildSettings(guildId, {
                $pull: { 'leveling.blacklistedRoles': role.id },
              });
              return safeReply(interaction, {
                content: `✅ Le rôle ${role} a été retiré de la liste noire.`,
                ephemeral: true,
              });

            case 'list': {
              const guildSettings = await xpController.getGuildSettings(guildId);
              const channels =
                (guildSettings.leveling.blacklistedChannels || [])
                  .map((id) => `<#${id}>`)
                  .join(', ') || 'Aucun';
              const roles =
                (guildSettings.leveling.blacklistedRoles || [])
                  .map((id) => `<@&${id}>`)
                  .join(', ') || 'Aucun';
              const embed = new EmbedBuilder()
                .setColor('#00ff9d')
                .setTitle('📋 Liste noire')
                .addFields(
                  { name: 'Canaux blacklistés', value: channels },
                  { name: 'Rôles blacklistés', value: roles }
                );
              return safeReply(interaction, { embeds: [embed], ephemeral: true });
            }

            default:
              return safeReply(interaction, {
                content: '❌ Action inconnue pour la blacklist.',
                ephemeral: true,
              });
          }
        }

        default:
          return safeReply(interaction, {
            content: '❌ Sous-commande non reconnue.',
            ephemeral: true,
          });
      }
    } catch (error) {
      logger.error('Erreur lors de la configuration du leveling:', error);
      return safeReply(interaction, {
        content: '❌ Une erreur est survenue lors de la configuration du système de niveau.',
        ephemeral: true,
      });
    }
  },
};
