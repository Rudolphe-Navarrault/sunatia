const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, userMention } = require('discord.js');
const { GuildSettings } = require('../../models/GuildSettings');
const Warning = require('../../models/Warning');
const logger = require('../../utils/logger');

// Fonction pour formater la date
const formatDate = (date) => {
  return date ? `<t:${Math.floor(date.getTime() / 1000)}:f>` : 'Jamais';
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('Affiche les avertissements et l\'historique de modération d\'un membre')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre dont vous voulez voir les logs')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const { guild, user } = interaction;

    try {
      // Vérifier les permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({
          content: '❌ Vous n\'avez pas la permission de voir les logs de modération.',
          ephemeral: true
        });
      }

      // Différer la réponse pour éviter le timeout
      await interaction.deferReply({ ephemeral: true });

      // Récupérer tous les avertissements du membre
      const warnings = await Warning.find({
        guildId: guild.id,
        userId: targetUser.id
      }).sort({ createdAt: -1 });

      // Compter les avertissements actifs et les points
      const activeWarnings = warnings.filter(w => w.active);
      const totalPoints = activeWarnings.reduce((sum, w) => sum + w.points, 0);

      // Créer l'embed principal
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setAuthor({
          name: `Historique de modération - ${targetUser.tag}`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true })
        })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { 
            name: '📊 Statistiques', 
            value: `**Avertissements actifs:** ${activeWarnings.length}\n` +
                   `**Points actifs:** ${totalPoints}\n` +
                   `**Total des avertissements:** ${warnings.length}`,
            inline: false
          }
        );

      // Ajouter les avertissements récents (limité à 5)
      const recentWarnings = warnings.slice(0, 5);
      if (recentWarnings.length > 0) {
        const warningsList = recentWarnings.map((warn, index) => {
          const moderator = guild.members.cache.get(warn.moderatorId)?.user || { tag: 'Inconnu', id: warn.moderatorId };
          return `**#${warnings.length - index}** • ${formatDate(warn.createdAt)}\n` +
                 `> **Modérateur:** ${userMention(moderator.id)}\n` +
                 `> **Points:** ${warn.points}${!warn.active ? ' (Expiré)' : ''}\n` +
                 `> **Raison:** ${warn.reason || 'Aucune raison fournie'}\n`;
        }).join('\n\n');

        embed.addFields({
          name: `📝 Avertissements récents (${recentWarnings.length}/${warnings.length})`,
          value: warningsList,
          inline: false
        });
      }

      // Vérifier si le serveur a un salon de logs configuré
      const settings = await GuildSettings.findOne({ guildId: guild.id });
      if (settings?.moderation?.logChannelId) {
        const logChannel = guild.channels.cache.get(settings.moderation.logChannelId);
        if (logChannel) {
          embed.addFields({
            name: '📜 Logs complets',
            value: `Consultez ${logChannel} pour voir l'historique complet des actions de modération.`,
            inline: false
          });
        }
      }

      // Ajouter les informations de compte
      const accountInfo = [
        `**Compte créé le:** ${formatDate(targetUser.createdAt)}`,
        `**A rejoint le serveur:** ${formatDate(guild.members.cache.get(targetUser.id)?.joinedAt)}`
      ];

      embed.addFields({
        name: '👤 Informations du compte',
        value: accountInfo.join('\n'),
        inline: false
      });

      // Ajouter le footer avec la date de la dernière action
      if (warnings.length > 0) {
        const lastAction = warnings[0].createdAt;
        embed.setFooter({ 
          text: `Dernière action: ${formatDate(lastAction)}`,
          iconURL: interaction.client.user.displayAvatarURL()
        });
      } else {
        embed.setFooter({ 
          text: 'Aucune action de modération enregistrée',
          iconURL: interaction.client.user.displayAvatarURL()
        });
      }

      // Envoyer l'embed
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Erreur lors de la récupération des logs de modération:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: '❌ Une erreur est survenue lors de la récupération des logs de modération.',
          ephemeral: true
        });
      }
      
      await interaction.editReply({
        content: '❌ Une erreur est survenue lors de la récupération des logs de modération.'
      });
    }
  }
};
