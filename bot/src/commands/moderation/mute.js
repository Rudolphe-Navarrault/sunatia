const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, time } = require('discord.js');
const logger = require('../../utils/logger');
const { sendModLog, formatDuration } = require('../../utils/modlog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Rendre un membre muet temporairement')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à rendre muet')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('duree')
        .setDescription('Durée du mute en minutes')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10080) // 1 semaine max
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison du mute')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    const duration = interaction.options.getInteger('duree');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { user } = interaction;
    const durationText = formatDuration(duration * 60 * 1000);

    // Vérifications de base
    if (member.id === user.id) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas vous rendre muet vous-même !',
        ephemeral: true
      });
    }

    if (member.id === interaction.client.user.id) {
      return interaction.reply({
        content: '❌ Je ne peux pas me rendre muet moi-même !',
        ephemeral: true
      });
    }

    if (!member.moderatable) {
      return interaction.reply({
        content: '❌ Je ne peux pas rendre ce membre muet. Vérifiez mes permissions et la hiérarchie des rôles.',
        ephemeral: true
      });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas rendre muet un membre avec un rôle supérieur ou égal au vôtre.',
        ephemeral: true
      });
    }

    try {
      // Convertir les minutes en millisecondes
      const durationMs = duration * 60 * 1000;
      const timeout = Date.now() + durationMs;
      const endDate = new Date(timeout);

      // Rendre le membre muet
      await member.timeout(durationMs, `Mute par ${user.tag} | Raison: ${reason}`);

      // Envoyer un message de confirmation
      const response = await interaction.reply({
        content: `✅ ${member.user.tag} a été rendu muet pour ${durationText}.`,
        ephemeral: true,
        fetchReply: true
      });

      // Envoyer le log de modération (géré automatiquement par le modèle)
      await sendModLog(interaction.guild, {
        action: 'MUTE',
        target: member.user,
        moderator: user,
        reason: reason,
        duration: durationMs,
        channel: interaction.channel,
        messageLink: `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}/${response.id}`
      });

      // Envoyer un message privé au membre
      try {
        await member.send({
          content: `Vous avez été réduit au silence sur **${interaction.guild.name}** pour ${durationText}.\n**Raison:** ${reason}\n**Fin du mute:** ${time(endDate, 'F')} (${time(endDate, 'R')})`
        });
      } catch (dmError) {
        logger.warn(`Impossible d'envoyer un message privé à ${member.user.tag} pour le mute`);
      }

      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a réduit au silence ${member.user.tag} (${member.id}) pour ${durationText}. Raison: ${reason || 'Aucune'}`);

      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a réduit au silence ${member.user.tag} (${member.id}) pour ${durationText}. Raison: ${reason || 'Aucune'}`);

      // Planifier le dé-mute
      setTimeout(async () => {
        try {
          if (member.communicationDisabledUntilTimestamp > Date.now()) {
            await member.timeout(null, 'Fin du mute automatique');
            logger.info(`[Modération] Mute automatiquement levé pour ${member.user.tag} (${member.id})`);

            // Envoyer un log pour le démute automatique
            await sendModLog(interaction.guild, {
              action: 'Unmute (Auto)',
              target: member.user,
              moderator: interaction.client.user,
              reason: 'Fin du mute automatique',
              color: 0x4CAF50
            });

            logger.info(`[Modération] Mute expiré pour ${member.user.tag} (${member.id})`);
            
            // Envoyer un message au membre
            try {
              await member.send(`Votre mute sur ${interaction.guild.name} a été levé.`);
            } catch (e) {
              logger.warn(`Impossible d'envoyer un message de fin de mute à ${member.user.tag}`);
            }
          }
        } catch (error) {
          logger.error(`Erreur lors de la levée du mute automatique pour ${member.user.tag}:`, error);
        }
      }, durationMs);

    } catch (error) {
      logger.error('Erreur lors du mute:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors du mute du membre.',
        ephemeral: true
      });
    }
  },
};
