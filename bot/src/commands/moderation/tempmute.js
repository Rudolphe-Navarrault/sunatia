const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, time } = require('discord.js');
const {
  parseDuration,
  formatDuration,
  extractDurationAndReason,
} = require('../../utils/parseDuration');
const { sendModLog } = require('../../utils/modlog');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempmute')
    .setDescription('Rendre un membre muet temporairement')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre à rendre muet').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('duree')
        .setDescription('Durée du mute (ex: 1d, 2h30m, 1j12h)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription('Raison du mute').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    const durationStr = interaction.options.getString('duree');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { user } = interaction;

    // Vérifications de base
    if (member.id === user.id) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas vous rendre muet vous-même !',
        ephemeral: true,
      });
    }

    if (member.id === interaction.client.user.id) {
      return interaction.reply({
        content: '❌ Je ne peux pas me rendre muet moi-même !',
        ephemeral: true,
      });
    }

    if (!member.moderatable) {
      return interaction.reply({
        content:
          '❌ Je ne peux pas rendre ce membre muet. Vérifiez mes permissions et la hiérarchie des rôles.',
        ephemeral: true,
      });
    }

    // Vérifier la hiérarchie des rôles
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content:
          '❌ Vous ne pouvez pas rendre muet un membre avec un rôle supérieur ou égal au vôtre.',
        ephemeral: true,
      });
    }

    try {
      // Parser la durée
      const durationMs = parseDuration(durationStr);
      const durationFormatted = formatDuration(durationMs);
      const timeoutEnds = new Date(Date.now() + durationMs);

      // Vérifier la durée maximale (28 jours - limite de Discord)
      const MAX_DURATION = 28 * 24 * 60 * 60 * 1000; // 28 jours en ms
      if (durationMs > MAX_DURATION) {
        return interaction.reply({
          content: `❌ La durée maximale est de 28 jours. Vous avez spécifié ${durationFormatted}.`,
          ephemeral: true,
        });
      }

      // Appliquer le timeout
      await member.timeout(durationMs, `Temporairement muet par ${user.tag} | Raison: ${reason}`);

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setColor('#9C27B0')
        .setTitle('🔇 Membre réduit au silence')
        .setDescription(`${member} a été réduit au silence pour ${durationFormatted}.`)
        .addFields(
          { name: 'Modérateur', value: user.toString(), inline: true },
          { name: 'Durée', value: durationFormatted, inline: true },
          { name: 'Raison', value: reason, inline: true },
          { name: 'Fin du mute', value: time(timeoutEnds, 'F'), inline: true },
          { name: 'Temps restant', value: `Expire ${time(timeoutEnds, 'R')}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Envoyer un message privé au membre
      try {
        await member.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#9C27B0')
              .setTitle(`🔇 Vous avez été réduit au silence sur ${interaction.guild.name}`)
              .setDescription(
                `Vous ne pouvez plus envoyer de messages ni réagir pendant ${durationFormatted}.`
              )
              .addFields(
                { name: 'Raison', value: reason, inline: true },
                { name: 'Durée', value: durationFormatted, inline: true },
                { name: 'Fin du mute', value: time(timeoutEnds, 'F'), inline: true },
                { name: 'Temps restant', value: `Expire ${time(timeoutEnds, 'R')}`, inline: true }
              )
              .setFooter({ text: "Contactez un modérateur pour plus d'informations" })
              .setTimestamp(),
          ],
        });
      } catch (dmError) {
        logger.warn(`Impossible d'envoyer un message privé à ${member.user.tag} pour le tempmute`);
      }

      // Envoyer le log de modération
      await sendModLog(interaction.guild, {
        action: 'tempmute', // correspond exactement au mapping
        target: member.user,
        moderator: user,
        reason: reason,
        duration: durationMs, // en ms, pas en string
        color: 0x9c27b0,
        fields: {
          'Fin du mute': time(timeoutEnds, 'F'),
          'Temps restant': `Expire ${time(timeoutEnds, 'R')}`,
        },
      });

      // Logger l'action
      logger.info(
        `[Modération] ${user.tag} (${user.id}) a réduit au silence ${member.user.tag} (${member.id}) pour ${durationFormatted}. Raison: ${reason}`
      );
    } catch (error) {
      logger.error('Erreur lors du tempmute:', error);

      let errorMessage = 'Une erreur est survenue lors du mute temporaire.';
      if (error.message.includes('invalid duration format')) {
        errorMessage =
          'Format de durée invalide. Utilisez des combinaisons comme 1d, 2h30m, 1j12h, etc.';
      }

      if (!interaction.replied) {
        await interaction.reply({
          content: `❌ ${errorMessage}`,
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: `❌ ${errorMessage}`,
          ephemeral: true,
        });
      }
    }
  },
};
