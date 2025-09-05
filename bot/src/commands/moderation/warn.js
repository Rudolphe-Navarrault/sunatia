const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Warning = require('../../models/Warning');
const logger = require('../../utils/logger');
const { sendModLog } = require('../../utils/modlog');

// Configuration des seuils d'avertissement
const WARNING_THRESHOLDS = [
  { points: 3, action: 'mute', duration: 60, description: 'Mute de 1 heure' },
  { points: 5, action: 'kick', description: 'Expulsion du serveur' },
  { points: 10, action: 'ban', description: 'Bannissement du serveur' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertir un membre')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à avertir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison de l\'avertissement')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('points')
        .setDescription('Points d\'avertissement (1-10)')
        .setMinValue(1)
        .setMaxValue(10)
    )
    .addStringOption(option =>
      option.setName('duree')
        .setDescription('Durée avant expiration (ex: 1d, 2w, 1m)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    const reason = interaction.options.getString('raison');
    const points = interaction.options.getInteger('points') || 1;
    const durationStr = interaction.options.getString('duree');
    const { user } = interaction;

    // Vérifications de base
    if (member.id === user.id) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas vous avertir vous-même !',
        ephemeral: true
      });
    }

    if (!member.moderatable) {
      return interaction.reply({
        content: '❌ Je ne peux pas avertir ce membre. Vérifiez mes permissions et la hiérarchie des rôles.',
        ephemeral: true
      });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas avertir un membre avec un rôle supérieur ou égal au vôtre.',
        ephemeral: true
      });
    }

    try {
      // Calculer la date d'expiration si une durée est fournie
      let expiresAt = null;
      if (durationStr) {
        const duration = this.parseDuration(durationStr);
        if (duration) {
          expiresAt = new Date(Date.now() + duration);
        }
      }

      // Créer l'avertissement
      const warning = new Warning({
        userId: member.id,
        guildId: interaction.guildId,
        moderatorId: user.id,
        reason,
        points,
        expiresAt
      });

      await warning.save();

      // Obtenir le total des points d'avertissement actifs
      const totalPoints = await Warning.getTotalPoints(member.id, interaction.guildId);

      // Vérifier les seuils d'avertissement
      const threshold = this.checkThresholds(totalPoints);
      let actionTaken = null;

      if (threshold) {
        switch (threshold.action) {
          case 'mute':
            await member.timeout(threshold.duration * 60 * 1000, `Seuil d'avertissement atteint (${threshold.points} points)`);
            actionTaken = `Mute automatique de ${threshold.duration} minutes`;
            break;
          case 'kick':
            await member.kick(`Seuil d'avertissement atteint (${threshold.points} points)`);
            actionTaken = 'Expulsion automatique';
            break;
          case 'ban':
            await member.ban({ reason: `Seuil d'avertissement atteint (${threshold.points} points)` });
            actionTaken = 'Bannissement automatique';
            break;
        }
      }

      // Envoyer un message de confirmation
      const response = await interaction.reply({
        content: `⚠️ ${member.user.tag} a été averti avec succès. (${points} point${points > 1 ? 's' : ''})`,
        ephemeral: true,
        fetchReply: true
      });

      // Envoyer le log de modération
      await sendModLog(interaction.guild, {
        action: 'WARN',
        target: member.user,
        moderator: user,
        reason: reason,
        points: points,
        totalPoints: totalPoints,
        duration: expiresAt ? expiresAt - Date.now() : null,
        channel: interaction.channel,
        messageLink: `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}/${response.id}`,
        actionTaken: actionTaken,
        color: 0xFFA500,
        fields: {
          'Points': points,
          'Total des points': totalPoints,
          'Expire le': expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>` : 'Jamais',
          'ID de l\'avertissement': warning._id.toString()
        }
      });

      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a averti ${member.user.tag} (${member.id}). Points: ${points}, Total: ${totalPoints}. Raison: ${reason || 'Aucune'}`);

      // Envoyer un message au membre
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#ffcc00')
          .setTitle(`⚠️ Vous avez reçu un avertissement sur ${interaction.guild.name}`)
          .setDescription(`**Raison:** ${reason}\n**Points:** ${points} (Total: ${totalPoints} pts)\n\nMerci de respecter les règles du serveur.`)
          .setTimestamp();

        if (actionTaken) {
          dmEmbed.addFields({
            name: 'Action prise',
            value: actionTaken,
            inline: true
          });
        }

        await member.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        logger.warn(`Impossible d'envoyer un message privé à ${member.user.tag} pour l'avertissement`);
      }

      // Logger l'action
      logger.info(`[Modération] ${member.user.tag} (${member.id}) a été averti par ${user.tag} (${user.id}). Raison: ${reason} (${points} points, Total: ${totalPoints} pts)`);

    } catch (error) {
      logger.error('Erreur lors de l\'avertissement:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'avertissement du membre.',
        ephemeral: true
      });
    }
  },

  /**
   * Vérifie si un seuil d'avertissement a été atteint
   * @param {number} totalPoints - Nombre total de points d'avertissement
   * @returns {Object|null} Le seuil atteint ou null
   */
  checkThresholds(totalPoints) {
    return WARNING_THRESHOLDS.find(threshold => totalPoints >= threshold.points) || null;
  },

  /**
   * Parse une durée en millisecondes (ex: 1d, 2w, 1m)
   * @param {string} durationStr - La durée à parser
   * @returns {number|null} La durée en millisecondes ou null si invalide
   */
  parseDuration(durationStr) {
    const match = durationStr.match(/^(\d+)([dwmh])$/i);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const multipliers = {
      'h': 60 * 60 * 1000,  // heures
      'd': 24 * 60 * 60 * 1000,  // jours
      'w': 7 * 24 * 60 * 60 * 1000,  // semaines
      'm': 30 * 24 * 60 * 60 * 1000  // mois (30 jours)
    };

    return value * (multipliers[unit] || 0);
  }
};
