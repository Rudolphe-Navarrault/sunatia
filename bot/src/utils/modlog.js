const { EmbedBuilder } = require('discord.js');
const { GuildSettings } = require('../models/GuildSettings');
const logger = require('./logger');

// Mappage des actions vers les types de logs
const ACTION_TO_LOG_TYPE = {
  // Commandes de base
  ban: 'ban',
  unban: 'unban',
  kick: 'kick',
  mute: 'mute',
  warn: 'warn',
  purge: 'purge',
  lock: 'lock',
  unlock: 'unlock',
  slowmode: 'slowmode',

  // Commandes temporaires
  tempmute: 'tempmute',
  tempban: 'tempban',
  tempwarn: 'tempwarn',

  // Autres événements
  'membre mis à jour': 'memberUpdate',
  'message supprimé': 'messageDelete',
  'message modifié': 'messageUpdate',
  'rôle créé': 'roleCreate',
  'rôle supprimé': 'roleDelete',
  'rôle mis à jour': 'roleUpdate',
  'salon créé': 'channelCreate',
  'salon supprimé': 'channelDelete',
  'salon mis à jour': 'channelUpdate',

  // Actions automatiques
  'unban (auto)': 'unban',
  'unmute (auto)': 'mute',
  'avertissement expiré': 'warn',
};

/**
 * Envoie un log de modération dans le salon configuré
 * @param {Guild} guild - La guilde où l'action a eu lieu
 * @param {Object} options - Les options du log
 * @returns {Promise<void>}
 */
const sendModLog = async (
  guild,
  {
    action,
    target,
    moderator,
    reason,
    color = '#3498db',
    fields = {},
    duration,
    logType: customLogType,
    actionTaken,
  }
) => {
  try {
    if (!guild || !action || !target || !moderator) {
      logger.warn('Paramètres manquants pour le log de modération:', {
        action,
        guild: !!guild,
        target: !!target,
        moderator: !!moderator,
      });
      return;
    }

    // Récupérer les paramètres du serveur
    const settings = await GuildSettings.findOne({ guildId: guild.id });
    if (!settings) {
      logger.warn(`Aucun paramètre trouvé pour la guilde ${guild.id}`);
      return;
    }

    if (!settings.moderation) settings.moderation = { logChannelId: null, logSettings: {} };
    if (!settings.moderation.logSettings) settings.moderation.logSettings = {};

    // Normaliser l'action pour matcher le mapping
    const normalizedAction = String(action).toLowerCase().trim();
    const logType = (
      customLogType ||
      ACTION_TO_LOG_TYPE[normalizedAction] ||
      normalizedAction
    ).toLowerCase();

    logger.debug(
      `Résolution logType → action="${action}", normalized="${normalizedAction}", final="${logType}"`
    );

    // Initialiser la config si absente
    if (!settings.moderation.logSettings[logType]) {
      settings.moderation.logSettings[logType] = { enabled: true, channelId: null };
    }

    const logConfig = settings.moderation.logSettings[logType];
    if (logConfig.enabled === false) {
      logger.debug(`Log désactivé pour le type: ${logType}`);
      return;
    }

    // Déterminer le salon de logs
    const logChannelId = logConfig.channelId || settings.moderation.logChannelId;
    if (!logChannelId) {
      logger.warn(`Aucun canal de log défini pour ${logType} dans la guilde ${guild.id}`);
      return;
    }

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) {
      logger.warn(`Canal de log introuvable: ${logChannelId} dans la guilde ${guild.id}`);
      return;
    }

    if (
      !logChannel
        .permissionsFor(guild.members.me)
        .has(['ViewChannel', 'SendMessages', 'EmbedLinks'])
    ) {
      logger.warn(
        `Permissions insuffisantes pour envoyer des logs dans ${logChannel.name} (${logChannel.id})`
      );
      return;
    }

    // Construire l'embed
    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${moderator.tag} (${moderator.id})`,
        iconURL: moderator.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(
        `**Action :** ${action}` +
          (actionTaken ? `\n**Action automatique :** ${actionTaken}` : '') +
          `\n**Membre :** ${target.tag} (${target.id})\n**Raison :** ${reason || 'Aucune raison fournie'}`
      )
      .setTimestamp()
      .setFooter({ text: `ID: ${target.id}` });

    const fieldsToAdd = [
      { name: '🛡️ Modérateur', value: `${moderator}`, inline: true },
      { name: '📝 Raison', value: reason || 'Aucune raison fournie', inline: true },
    ];

    if (duration) {
      fieldsToAdd.push({
        name: '⏱️ Durée',
        value: formatDuration(duration / 1000),
        inline: true,
      });
    }

    if (fields && typeof fields === 'object') {
      for (const [name, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) {
          fieldsToAdd.push({
            name,
            value: String(value).substring(0, 1000),
            inline: true,
          });
        }
      }
    }

    for (let i = 0; i < fieldsToAdd.length; i += 3) {
      embed.addFields(fieldsToAdd.slice(i, i + 3));
    }

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('Erreur lors de la préparation/envoi du log de modération:', error);
  }
};

/**
 * Formate une durée en secondes en une chaîne lisible
 */
function formatDuration(seconds) {
  if (isNaN(seconds) || !isFinite(seconds) || seconds <= 0) {
    return 'Permanent';
  }

  seconds = Math.floor(seconds);
  const days = Math.floor(seconds / (3600 * 24));
  seconds %= 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const parts = [];
  if (days > 0) parts.push(`${days} jour${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} heure${hours > 1 ? 's' : ''}`);
  if (minutes > 0 && days === 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (seconds > 0 && hours === 0 && days === 0)
    parts.push(`${seconds} seconde${seconds > 1 ? 's' : ''}`);

  return parts.join(' ') || "moins d'une minute";
}

module.exports = {
  sendModLog,
  formatDuration,
};
