const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const { sendModLog } = require('../../utils/modlog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre du serveur')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à expulser')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison de l\'expulsion')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { user } = interaction;

    // Vérifier si le bot peut expulser le membre
    if (!member.kickable) {
      return interaction.reply({
        content: '❌ Je ne peux pas expulser ce membre. Vérifiez mes permissions et la hiérarchie des rôles.',
        ephemeral: true
      });
    }

    // Vérifier si l'utilisateur essaie de s'expulser lui-même
    if (member.id === user.id) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas vous expulser vous-même !',
        ephemeral: true
      });
    }

    // Vérifier si l'utilisateur a la permission d'expulser ce membre
    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas expulser un membre avec un rôle supérieur ou égal au vôtre.',
        ephemeral: true
      });
    }

    try {
      // Expulser le membre
      await member.kick(`[${user.tag}] ${reason}`);

      // Envoyer un message de confirmation
      const response = await interaction.reply({
        content: `✅ ${member.user.tag} a été expulsé avec succès.`,
        ephemeral: true,
        fetchReply: true
      });
      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('👢 Membre expulsé')
        .setDescription(`${member.user.tag} a été expulsé du serveur.`)
        .addFields(
          { name: 'Modérateur', value: user.toString(), inline: true },
          { name: 'Raison', value: reason || 'Aucune raison fournie', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      
      // Envoyer le log de modération
      await sendModLog(interaction.guild, {
        action: 'Kick',
        target: member.user,
        moderator: user,
        reason: reason || 'Aucune raison fournie',
        color: 0xFFA500
      });
      
      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a expulsé ${member.user.tag} (${member.id}). Raison: ${reason || 'Aucune'}`);

    } catch (error) {
      logger.error('Erreur lors de l\'expulsion:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'expulsion.',
        ephemeral: true
      });
    }
  },
};
