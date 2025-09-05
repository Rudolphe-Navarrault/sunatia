const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');
const { sendModLog } = require('../../utils/modlog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannir un utilisateur du serveur')
    .addStringOption(option =>
      option.setName('utilisateur')
        .setDescription('ID ou mention de l\'utilisateur à débannir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison du débannissement')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const userInput = interaction.options.getString('utilisateur');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { user } = interaction;

    try {
      // Essayer de récupérer l'utilisateur à partir de l'ID ou de la mention
      let userId = userInput;
      
      // Si c'est une mention, extraire l'ID
      const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
      if (mentionMatch) {
        userId = mentionMatch[1];
      }
      
      // Vérifier si l'ID est valide
      if (!/^\d+$/.test(userId)) {
        return interaction.reply({
          content: '❌ ID utilisateur invalide. Utilisez un ID valide ou mentionnez l\'utilisateur.',
          ephemeral: true
        });
      }

      // Vérifier si l'utilisateur est banni
      const bans = await interaction.guild.bans.fetch();
      const bannedUser = bans.get(userId);
      
      if (!bannedUser) {
        return interaction.reply({
          content: '❌ Cet utilisateur n\'est pas banni de ce serveur.',
          ephemeral: true
        });
      }

      // Débannir l'utilisateur
      await interaction.guild.members.unban(userId, `[${user.tag}] ${reason}`);
      
      // Envoyer un message de confirmation
      const response = await interaction.reply({
        content: `✅ ${bannedUser.user.tag} a été débanni avec succès.`,
        ephemeral: true,
        fetchReply: true
      });

      // Envoyer le log de modération
      await sendModLog(interaction.guild, {
        action: 'UNBAN',
        target: bannedUser.user,
        moderator: user,
        reason: reason,
        channel: interaction.channel,
        messageLink: `https://discord.com/channels/${interaction.guild.id}/${interaction.channel.id}/${response.id}`
      });

      logger.info(`[Modération] ${user.tag} (${user.id}) a débanni ${bannedUser.user.tag} (${userId}). Raison: ${reason}`);

    } catch (error) {
      logger.error('Erreur lors du débannissement:', error);
      
      if (error.code === 10026) { // Unknown Ban
        return interaction.reply({
          content: '❌ Cet utilisateur n\'est pas banni de ce serveur.',
          ephemeral: true
        });
      }
      
      await interaction.reply({
        content: '❌ Une erreur est survenue lors du débannissement de l\'utilisateur.',
        ephemeral: true
      });
    }
  }
};
