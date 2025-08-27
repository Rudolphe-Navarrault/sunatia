const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const xpController = require('../../controllers/xpController');
const User = require('../../models/User');
const leaderboardCommand = require('./leaderboard'); // pour accéder au cache
const logger = require('../../utils/logger');

// --- Fonction utilitaire pour répondre en toute sécurité ---
async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply(options).catch(() => {});
    } else {
      return interaction.reply(options).catch(() => {});
    }
  } catch (err) {
    logger.error('Erreur dans safeReply:', err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Affiche ton niveau et ton classement')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription("L'utilisateur dont tu veux voir le classement")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      // Différer la réponse si ce n’est pas déjà fait
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false });
      }

      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
      const userId = targetUser.id;
      const guildId = interaction.guildId;

      // Récupérer le rang et XP de l'utilisateur
      const rank = await xpController.getUserRank(userId, guildId);
      if (!rank) {
        return safeReply(interaction, `${targetUser} n'a pas encore de niveau sur ce serveur.`);
      }

      // Forcer le refresh du leaderboard
      const page = 1;
      leaderboardCommand.LEADERBOARD_CACHE.delete(`${guildId}_${page}`);
      const leaderboardData = await xpController.getLeaderboard(guildId, page, 10);

      // Construire la liste top 10 avec username depuis User
      const rankListArray = await Promise.all(
        leaderboardData.users.map(async (user, index) => {
          const medal =
            index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

          // Récupérer les infos depuis User
          const userData = await User.findOne({ userId: user.userId, guildId }).lean();
          const username = userData?.username || 'Utilisateur inconnu';

          return `${medal} ${username}: Niveau ${user.level || 1} (${user.xp || 0} XP)`;
        })
      );

      const rankList = rankListArray.join('\n') || 'Aucune donnée disponible.';

      // Créer l'embed
      const embed = new EmbedBuilder()
        .setColor('#00ff9d')
        .setAuthor({
          name: `Niveau de ${targetUser.username}`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true }),
        })
        .addFields(
          { name: 'Niveau', value: rank.level.toString(), inline: true },
          { name: 'XP', value: rank.xp.toString(), inline: true },
          { name: 'Rang', value: `#${rank.position} sur ${rank.total}`, inline: true },
          {
            name: 'Progression',
            value: `${rank.xpProgress}/${rank.xpNeeded} XP (${rank.progressPercentage}%)`,
            inline: false,
          },
          { name: '\u200B', value: '**Top 10 Classement**', inline: false }
        )
        .setDescription(`\`\`\`\n${rankList}\n\`\`\``)
        .setFooter({
          text: `Demandé par ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error("Erreur lors de l'exécution de la commande rank:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Erreur')
        .setDescription('Une erreur est survenue lors de la récupération du classement.')
        .setFooter({ text: 'Veuillez réessayer plus tard.' });

      return safeReply(interaction, { embeds: [errorEmbed] });
    }
  },
};
