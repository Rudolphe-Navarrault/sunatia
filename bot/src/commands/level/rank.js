const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const xpController = require('../../controllers/xpController');
const User = require('../../models/User');
const leaderboardCommand = require('../economy/leaderboard');
const logger = require('../../utils/logger');

// Constantes
const EPHEMERAL_FLAG = 1 << 6; // 64

// --- Fonction utilitaire pour répondre en toute sécurité ---
async function safeReply(interaction, options) {
  if (!interaction) return;
  
  // S'assurer que les options ont le bon format
  const replyOptions = {
    ...options,
    flags: options.ephemeral ? EPHEMERAL_FLAG : 0
  };
  
  // Supprimer l'option éphemérale obsolète
  delete replyOptions.ephemeral;
  
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.editReply(replyOptions);
    } else {
      return await interaction.reply(replyOptions);
    }
  } catch (error) {
    logger.error('Erreur dans safeReply:', error);
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
    const isEphemeral = false;
    const flags = isEphemeral ? 1 << 6 : 0;
    
    try {
      // Vérifier si l'interaction est valide
      if (!interaction.isCommand()) return;
      
      // Si l'interaction est déjà traitée, on ne fait rien
      if (interaction.replied || interaction.deferred) return;
      
      // Différer la réponse immédiatement
      try {
        await interaction.deferReply({ flags });
      } catch (deferError) {
        // Si le defer échoue, on arrête là
        if (deferError.code === 10062) return; // Interaction déjà expirée
        throw deferError;
      }
      
      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
      const userId = targetUser.id;
      const guildId = interaction.guildId;

      // Récupérer le rang et XP de l'utilisateur
      const rank = await xpController.getUserRank(userId, guildId);
      if (!rank) {
        const content = `${targetUser} n'a pas encore de niveau sur ce serveur.`;
        return interaction.editReply({ content, flags }).catch(() => {});
      }

      // Récupérer les données du leaderboard
      const page = 1;
      const pageSize = 10;
      
      let leaderboardData;
      try {
        // Vérifier si le cache existe avant de tenter de le supprimer
        if (leaderboardCommand.LEADERBOARD_CACHE) {
          leaderboardCommand.LEADERBOARD_CACHE.delete(`${guildId}_${page}`);
        }
        
        leaderboardData = await xpController.getLeaderboard(guildId, page, pageSize);
        
        // Vérifier si les données du leaderboard sont valides
        if (!leaderboardData || !Array.isArray(leaderboardData.users)) {
          throw new Error('Les données du classement sont invalides.');
        }
      } catch (error) {
        logger.error('Erreur lors de la récupération du leaderboard:', error);
        return safeReply(interaction, {
          content: '❌ Une erreur est survenue lors de la récupération du classement.',
          ephemeral: true
        });
      }

      // Construire la liste top 10 avec username depuis User
      let rankList;
      try {
        const rankListArray = await Promise.all(
          leaderboardData.users.map(async (user, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            const userData = await User.findOne({ userId: user.userId, guildId }).lean();
            const username = userData?.username || 'Utilisateur inconnu';
            return `${medal} ${username}: Niveau ${user.level || 1} (${user.xp || 0} XP)`;
          })
        );
        rankList = rankListArray.join('\n') || 'Aucune donnée disponible.';
      } catch (error) {
        logger.error('Erreur lors de la construction du classement:', error);
        rankList = 'Impossible de charger le classement complet.';
      }

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

      // Envoyer la réponse finale
      await interaction.editReply({ embeds: [embed], flags }).catch(() => {});
    } catch (error) {
      // Ne pas logger les erreurs d'interaction déjà traitée ou expirée
      if (error.code === 10062 || error.code === 40060) return;
      
      logger.error("Erreur lors de l'exécution de la commande rank:", error);
      
      try {
        const errorMessage = "❌ Une erreur est survenue lors du chargement du classement.";
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorMessage, flags: 1 << 6 });
        } else {
          await interaction.reply({ content: errorMessage, flags: 1 << 6 });
        }
      } catch (replyError) {
        // Ignorer les erreurs d'interaction déjà traitée ou expirée
        if (replyError.code !== 10062 && replyError.code !== 40060) {
          logger.error('Échec de l\'envoi du message d\'erreur:', replyError);
        }
      }
    }
  },
};
