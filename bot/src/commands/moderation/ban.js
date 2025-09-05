const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const { sendModLog } = require('../../utils/modlog');
const { GuildSettings } = require('../../models/GuildSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre du serveur')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à bannir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('La raison du bannissement')
    )
    .addIntegerOption(option =>
      option.setName('jours')
        .setDescription('Nombre de jours de messages à supprimer (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    const reason = interaction.options.getString('raison');
    const days = interaction.options.getInteger('jours');
    const { user } = interaction;

    // Vérifier si le bot peut bannir le membre
    if (!member.bannable) {
      return interaction.reply({
        content: '❌ Je ne peux pas bannir ce membre. Vérifiez mes permissions et la hiérarchie des rôles.',
        ephemeral: true
      });
    }

    // Vérifier si l'utilisateur essaie de se bannir lui-même
    if (member.id === user.id) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas vous bannir vous-même !',
        ephemeral: true
      });
    }

    // Vérifier si l'utilisateur a la permission de bannir ce membre
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas bannir un membre avec un rôle supérieur ou égal au vôtre.',
        ephemeral: true
      });
    }

    try {
      // Effectuer le bannissement
      await member.ban({ 
        days: days || 0,
        reason: `[${user.tag}] ${reason || 'Aucune raison fournie'}`
      });

      // Envoyer un message de confirmation
      const response = await interaction.reply({
        content: `✅ ${member.user.tag} a été banni avec succès.`,
        ephemeral: true,
        fetchReply: true
      });

      // Envoyer le log de modération (géré automatiquement par le modèle)
      await sendModLog(interaction.guild, {
        action: 'BAN',
        target: member.user,
        moderator: user,
        reason: reason,
        duration: null,
        channel: interaction.channel,
        messageLink: `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}/${response.id}`
      });

      // Envoyer un message au membre banni (si possible)
      try {
        await member.send({
          content: `Vous avez été banni du serveur **${interaction.guild.name}**\n**Raison:** ${reason || 'Aucune raison fournie'}`
        });
      } catch (dmError) {
        logger.warn(`Impossible d'envoyer un MP à ${member.user.tag}: ${dmError.message}`);
      }
    } catch (error) {
      logger.error(`Erreur lors du bannissement de ${member.user.tag}:`, error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors du bannissement du membre.',
        ephemeral: true
      });
    }
  },
};
