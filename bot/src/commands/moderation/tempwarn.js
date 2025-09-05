const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, time } = require('discord.js');
const { parseDuration, formatDuration } = require('../../utils/parseDuration');
const { sendModLog } = require('../../utils/modlog');
const Warning = require('../../models/Warning');
const logger = require('../../utils/logger');

// Configuration des seuils d'avertissement
const WARNING_THRESHOLDS = [
  { points: 3, action: 'mute', duration: 60, description: 'Mute de 1 heure' },
  { points: 5, action: 'kick', description: 'Expulsion du serveur' },
  { points: 10, action: 'ban', description: 'Bannissement du serveur' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempwarn')
    .setDescription('Donner un avertissement temporaire à un membre')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à avertir')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('points')
        .setDescription('Nombre de points à attribuer (1-10)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duree')
        .setDescription('Durée de validité de l\'avertissement (ex: 1d, 2h30m, 1j12h)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison de l\'avertissement')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    const points = interaction.options.getInteger('points');
    const durationStr = interaction.options.getString('duree');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { user, guild } = interaction;

    // Vérifications de base
    if (member.id === user.id) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas vous avertir vous-même !',
        ephemeral: true
      });
    }

    if (member.id === interaction.client.user.id) {
      return interaction.reply({
        content: '❌ Je ne peux pas m\'avertir moi-même !',
        ephemeral: true
      });
    }

    if (!member.moderatable) {
      return interaction.reply({
        content: '❌ Je ne peux pas avertir ce membre. Vérifiez mes permissions et la hiérarchie des rôles.',
        ephemeral: true
      });
    }

    // Vérifier la hiérarchie des rôles
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas avertir un membre avec un rôle supérieur ou égal au vôtre.',
        ephemeral: true
      });
    }

    try {
      // Parser la durée
      const durationMs = parseDuration(durationStr);
      const durationFormatted = formatDuration(durationMs);
      const expiresAt = new Date(Date.now() + durationMs);

      // Vérifier la durée minimale (5 minutes)
      const MIN_DURATION = 5 * 60 * 1000; // 5 minutes en ms
      if (durationMs < MIN_DURATION) {
        return interaction.reply({
          content: `❌ La durée minimale est de 5 minutes. Vous avez spécifié ${durationFormatted}.`,
          ephemeral: true
        });
      }

      // Calculer la date d'expiration
      const expiresAtDate = new Date(Date.now() + durationMs);

      // Enregistrer l'avertissement dans la base de données
      const warning = new Warning({
        userId: member.id,
        guildId: guild.id,
        moderatorId: user.id,
        reason: reason,
        points: points,
        expiresAt: expiresAtDate,
        isTemporary: true
      });

      await warning.save();

      // Récupérer le total des points actifs
      const activeWarnings = await Warning.find({
        userId: member.id,
        guildId: guild.id,
        active: true,
        $or: [
          { expiresAt: { $gt: new Date() } },
          { expiresAt: null }
        ]
      });

      const totalPoints = activeWarnings.reduce((sum, w) => sum + w.points, 0);

      // Vérifier les seuils d'avertissement
      let actionTaken = '';
      for (const threshold of WARNING_THRESHOLDS) {
        if (totalPoints >= threshold.points) {
          actionTaken = threshold.description;
          break;
        }
      }

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⚠️ Avertissement temporaire')
        .setDescription(`${member} a reçu un avertissement temporaire.`)
        .addFields(
          { name: 'Modérateur', value: user.toString(), inline: true },
          { name: 'Points', value: `${points} (Total: ${totalPoints}/${WARNING_THRESHOLDS[WARNING_THRESHOLDS.length - 1].points})`, inline: true },
          { name: 'Raison', value: reason, inline: true },
          { name: 'Expire le', value: time(expiresAtDate, 'F'), inline: true },
          { name: 'Temps restant', value: `Expire ${time(expiresAtDate, 'R')}`, inline: true }
        )
        .setTimestamp();

      if (actionTaken) {
        embed.addFields({
          name: '⚠️ Seuil atteint',
          value: `Le membre a atteint ${totalPoints} points: ${actionTaken}`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

      // Envoyer un message privé au membre
      try {
        await member.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#FFA500')
              .setTitle(`⚠️ Vous avez reçu un avertissement sur ${guild.name}`)
              .setDescription(`**Raison:** ${reason}\n**Points:** ${points} (Total: ${totalPoints} pts)\n**Expire le:** ${time(expiresAtDate, 'F')}`)
              .addFields(
                { name: 'Modérateur', value: user.toString(), inline: true },
                { name: 'Temps restant', value: `Expire ${time(expiresAtDate, 'R')}`, inline: true },
                { name: 'Total des points', value: `${totalPoints}/${WARNING_THRESHOLDS[WARNING_THRESHOLDS.length - 1].points}`, inline: true }
              )
              .setFooter({ text: 'Merci de respecter les règles du serveur' })
              .setTimestamp()
          ]
        });
      } catch (dmError) {
        logger.warn(`Impossible d'envoyer un message privé à ${member.user.tag} pour l'avertissement`);
      }

      // Envoyer le log de modération
      await sendModLog(interaction.guild, {
        action: 'Temp Warn',
        target: member.user,
        moderator: user,
        reason: reason,
        duration: durationFormatted,
        color: 0xFFA500,
        fields: {
          'Points': `${points} (Total: ${totalPoints})`,
          'Expire le': time(expiresAtDate, 'F'),
          'Temps restant': `Expire ${time(expiresAtDate, 'R')}`
        }
      });

      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a averti ${member.user.tag} (${member.id}). Points: ${points}, Total: ${totalPoints}. Raison: ${reason}`);

      // Planifier l'expiration de l'avertissement
      setTimeout(async () => {
        try {
          warning.active = false;
          await warning.save();
          logger.info(`[Modération] Avertissement expiré pour ${member.user.tag} (${member.id})`);
          
          // Envoyer un log pour l'expiration
          await sendModLog(interaction.guild, {
            action: 'Avertissement expiré',
            target: member.user,
            moderator: interaction.client.user,
            reason: 'Avertissement temporaire expiré',
            color: 0x4CAF50,
            fields: {
              'ID de l\'avertissement': warning._id.toString(),
              'Points retirés': points
            }
          });
          
        } catch (error) {
          logger.error(`Erreur lors de l'expiration de l'avertissement pour ${member.user.tag}:`, error);
        }
      }, durationMs);

    } catch (error) {
      logger.error('Erreur lors de l\'avertissement temporaire:', error);
      
      let errorMessage = 'Une erreur est survenue lors de l\'avertissement temporaire.';
      if (error.message.includes('invalid duration format')) {
        errorMessage = 'Format de durée invalide. Utilisez des combinaisons comme 1d, 2h30m, 1j12h, etc.';
      }
      
      if (!interaction.replied) {
        await interaction.reply({
          content: `❌ ${errorMessage}`,
          ephemeral: true
        });
      } else {
        await interaction.followUp({
          content: `❌ ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }
};
