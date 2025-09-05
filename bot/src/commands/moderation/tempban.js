const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, time } = require('discord.js');
const { parseDuration, formatDuration } = require('../../utils/parseDuration');
const { sendModLog } = require('../../utils/modlog');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Bannir temporairement un membre du serveur')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à bannir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duree')
        .setDescription('Durée du bannissement (ex: 1d, 2h30m, 1j12h)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison du bannissement')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('jours')
        .setDescription('Nombre de jours de messages à supprimer (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    const durationStr = interaction.options.getString('duree');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const days = interaction.options.getInteger('jours') || 0;
    const { user } = interaction;

    // Vérifications de base
    if (member.id === user.id) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas vous bannir vous-même !',
        ephemeral: true
      });
    }

    if (member.id === interaction.client.user.id) {
      return interaction.reply({
        content: '❌ Je ne peux pas me bannir moi-même !',
        ephemeral: true
      });
    }

    if (!member.bannable) {
      return interaction.reply({
        content: '❌ Je ne peux pas bannir ce membre. Vérifiez mes permissions et la hiérarchie des rôles.',
        ephemeral: true
      });
    }

    // Vérifier la hiérarchie des rôles
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas bannir un membre avec un rôle supérieur ou égal au vôtre.',
        ephemeral: true
      });
    }

    // Convertir la durée en millisecondes
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.reply({
        content: '❌ Format de durée invalide. Utilisez par exemple: 1d, 2h, 30m, 1j12h',
        ephemeral: true
      });
    }

    // Vérifier la durée minimale (5 minutes)
    if (durationMs < 5 * 60 * 1000) {
      return interaction.reply({
        content: '❌ La durée minimale est de 5 minutes.',
        ephemeral: true
      });
    }

    // Vérifier la durée maximale (1 an)
    const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 an en ms
    if (durationMs > maxDuration) {
      return interaction.reply({
        content: '❌ La durée maximale est de 1 an.',
        ephemeral: true
      });
    }

    const unbanTimestamp = Date.now() + durationMs;
    const formattedDuration = formatDuration(durationMs);
    const unbanDate = new Date(unbanTimestamp);

    try {
      // Bannir le membre
      await member.ban({
        reason: `[${user.tag}] Bannissement temporaire (${formattedDuration}): ${reason}`,
        deleteMessageDays: days
      });

      // Envoyer un message de confirmation
      const response = await interaction.reply({
        content: `✅ ${member.user.tag} a été banni temporairement pour ${formattedDuration}.`,
        ephemeral: true,
        fetchReply: true
      });

      // Envoyer le log de modération (géré automatiquement par le modèle)
      await sendModLog(interaction.guild, {
        action: 'TEMPBAN',
        target: member.user,
        moderator: user,
        reason: reason,
        duration: durationMs,
        channel: interaction.channel,
        messageLink: `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}/${response.id}`
      });

      // Envoyer un message au membre banni (si possible)
      try {
        await member.send({
          content: `Vous avez été banni temporairement du serveur **${interaction.guild.name}** pour ${formattedDuration}.\n**Raison:** ${reason}\n**Date de fin:** ${time(unbanDate, 'F')} (${time(unbanDate, 'R')})`
        });
      } catch (dmError) {
        logger.warn(`Impossible d'envoyer un MP à ${member.user.tag}: ${dmError.message}`);
      }

      // Planifier le débannissement
      setTimeout(async () => {
        try {
          await interaction.guild.members.unban(member.id, 'Fin du bannissement temporaire');
          logger.info(`[Modération] Débannissement automatique pour ${member.user.tag} (${member.id})`);
          
          // Envoyer un log pour le débannissement automatique
          await sendModLog(interaction.guild, {
            action: 'Unban (Auto)',
            target: member.user,
            moderator: interaction.client.user,
            reason: 'Fin du bannissement temporaire',
            color: 0x4CAF50
          });
          
        } catch (error) {
          logger.error(`Erreur lors du débannissement automatique de ${member.user.tag}:`, error);
        }
      }, durationMs);

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔨 Membre banni temporairement')
        .setDescription(`${member} a été banni du serveur pour ${durationFormatted}.`)
        .addFields(
          { name: 'Modérateur', value: user.toString(), inline: true },
          { name: 'Durée', value: durationFormatted, inline: true },
          { name: 'Raison', value: reason, inline: true },
          { name: 'Débanni le', value: time(unbanDate, 'F'), inline: true },
          { name: 'Temps restant', value: `Expire ${time(unbanDate, 'R')}`, inline: true }
        )
        .setTimestamp();

      if (days > 0) {
        embed.addFields({ 
          name: 'Messages supprimés', 
          value: `Messages des ${days} derniers jours supprimés`, 
          inline: true 
        });
      }

      await interaction.reply({ embeds: [embed] });

      // Envoyer un message privé au membre
      try {
        await member.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle(`🔨 Vous avez été banni temporairement de ${interaction.guild.name}`)
              .setDescription(`Votre bannissement expirera le ${time(unbanDate, 'F')}`)
              .addFields(
                { name: 'Raison', value: reason, inline: true },
                { name: 'Durée', value: durationFormatted, inline: true },
                { name: 'Débanni le', value: time(unbanDate, 'F'), inline: true },
                { name: 'Temps restant', value: `Expire ${time(unbanDate, 'R')}`, inline: true }
              )
              .setFooter({ text: 'Contactez un modérateur pour faire appel' })
              .setTimestamp()
          ]
        });
      } catch (dmError) {
        logger.warn(`Impossible d'envoyer un message privé à ${member.user.tag} pour le tempban`);
      }

      // Envoyer le log de modération
      await sendModLog(interaction.guild, {
        action: 'Temp Ban',
        target: member.user,
        moderator: user,
        reason: reason,
        duration: durationFormatted,
        color: 0xFF0000,
        fields: {
          'Débanni le': time(unbanDate, 'F'),
          'Temps restant': `Expire ${time(unbanDate, 'R')}`,
          'Messages supprimés': days > 0 ? `Messages des ${days} derniers jours` : 'Aucun message supprimé'
        }
      });

      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a banni temporairement ${member.user.tag} (${member.id}) pour ${durationFormatted}. Raison: ${reason}`);

    } catch (error) {
      logger.error('Erreur lors du tempban:', error);
      
      let errorMessage = 'Une erreur est survenue lors du bannissement temporaire.';
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
