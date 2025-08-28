const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const Coins = require('../../models/Coins'); // Modèle monnaie
const XP = require('../../models/XP'); // Modèle XP
const User = require('../../models/User'); // Modèle usernames
const logger = require('../../utils/logger');

const ITEMS_PER_PAGE = 10;
const LEADERBOARD_CACHE = new Map();
const oneHour = 60 * 60 * 1000; // Une heure en millisecondes

// Nettoyer le cache toutes les heures
function cleanCache() {
  const now = Date.now();
  for (const [key, data] of LEADERBOARD_CACHE.entries()) {
    if (now - data.timestamp > oneHour) LEADERBOARD_CACHE.delete(key);
  }
}
setInterval(cleanCache, oneHour);

// Générer une clé de cache unique
function getCacheKey(type, guildId, page) {
  return `${type}_${guildId}_${page}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Affiche le classement des membres du serveur')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Type de classement à afficher')
        .addChoices({ name: 'Argent', value: 'money' }, { name: 'Niveaux', value: 'xp' })
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName('page').setDescription('Numéro de page').setMinValue(1)
    )
    .addBooleanOption((option) =>
      option.setName('force_refresh').setDescription('Forcer le rafraîchissement')
    ),

  async execute(interaction) {
    // Déférer la réponse immédiatement pour éviter les timeouts
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: 1 << 6 }).catch(() => {});
    }

    try {
      // Gestion des boutons
      if (interaction.isButton()) {
        const [action, type, pageStr] = interaction.customId.split('_');
        const page = parseInt(pageStr) || 1;

        if (action === 'refresh') {
          await this.displayLeaderboard(interaction, type, page, true);
        } else if (action === 'page') {
          await this.displayLeaderboard(interaction, type, page, false);
        } else {
          return interaction.editReply({
            content: '❌ Commande invalide. Veuillez réessayer.',
            flags: 1 << 6,
          });
        }
        return;
      }

      // Options de la commande
      const type = interaction.options.getString('type');
      const page = Math.max(1, interaction.options.getInteger('page') || 1);
      const forceRefresh = interaction.options.getBoolean('force_refresh') || false;

      await this.displayLeaderboard(interaction, type, page, forceRefresh);
    } catch (error) {
      logger.error('Erreur dans la commande leaderboard :', error);
      const errorMessage =
        interaction.replied || interaction.deferred
          ? '❌ Une erreur est survenue lors de la mise à jour du classement.'
          : "❌ Une erreur est survenue lors de l'exécution de la commande.";

      return interaction
        .editReply({
          content: errorMessage,
          flags: 1 << 6,
        })
        .catch(() => {});
    }
  },

  async displayLeaderboard(interaction, type, page = 1, forceRefresh = false) {
    const isDeferred = interaction.deferred || interaction.replied;
    const respond = isDeferred
      ? interaction.editReply.bind(interaction)
      : interaction.reply.bind(interaction);

    try {
      const guildId = interaction.guild.id;
      const skip = (page - 1) * ITEMS_PER_PAGE;
      const cacheKey = getCacheKey(type, guildId, page);

      if (forceRefresh) LEADERBOARD_CACHE.delete(cacheKey);

      let leaderboard = LEADERBOARD_CACHE.get(cacheKey)?.data;

      if (!leaderboard) {
        let totalUsers = 0;
        let totalPages = 1;
        let topUsers = [];

        if (type === 'money') {
          totalUsers = await Coins.countDocuments({ guildId });
          totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE) || 1;

          if (page > totalPages && totalPages > 0) {
            return respond({
              content: `❌ La page ${page} n'existe pas. Il y a ${totalPages} page(s) disponible(s).`,
              flags: 1 << 6,
            });
          }

          topUsers = await Coins.find({ guildId })
            .sort({ balance: -1 })
            .skip(skip)
            .limit(ITEMS_PER_PAGE)
            .lean();
        } else {
          totalUsers = await XP.countDocuments({ guildId });
          totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE) || 1;

          if (page > totalPages && totalPages > 0) {
            return respond({
              content: `❌ La page ${page} n'existe pas. Il y a ${totalPages} page(s) disponible(s).`,
              flags: 1 << 6,
            });
          }

          topUsers = await XP.find({ guildId })
            .sort({ level: -1, xp: -1 })
            .skip(skip)
            .limit(ITEMS_PER_PAGE)
            .lean();
        }

        leaderboard = {
          users: topUsers,
          total: totalUsers,
          pages: totalPages,
          type,
        };

        LEADERBOARD_CACHE.set(cacheKey, { data: leaderboard, timestamp: Date.now() });
      }

      if (!leaderboard.users || leaderboard.users.length === 0) {
        const noDataEmbed = new EmbedBuilder()
          .setColor('#ff9900')
          .setDescription('Aucun classement disponible pour le moment.');
        return respond({
          embeds: [noDataEmbed],
          components: [],
          flags: 1 << 6,
        });
      }

      // Récupération des usernames depuis DB ou Discord
      const usersWithNames = await Promise.all(
        leaderboard.users.map(async (user, index) => {
          const position = (page - 1) * ITEMS_PER_PAGE + index + 1;
          const medal =
            position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`;

          let username = 'Utilisateur inconnu';
          try {
            const userData = await User.findOne({ userId: user.userId, guildId }).lean();
            if (userData?.username) username = userData.username;
            else {
              const discordUser = await interaction.client.users.fetch(user.userId);
              username = discordUser.username;
            }
          } catch {}

          if (leaderboard.type === 'money') {
            return `${medal} **${username}** - ${user.balance || 0} <:coin:1240070496038350919>`;
          } else {
            return `${medal} **${username}** - Niveau ${user.level || 1} (${user.xp || 0} XP)`;
          }
        })
      );

      const title =
        leaderboard.type === 'money'
          ? '🏆 Classement des plus riches'
          : '🏆 Classement des niveaux';

      const embed = new EmbedBuilder()
        .setColor('#00ff9d')
        .setTitle(`${title} - Page ${page}/${leaderboard.pages || 1}`)
        .setDescription(usersWithNames.join('\n') || 'Aucune donnée à afficher.')
        .setFooter({
          text: `Page ${page}/${leaderboard.pages || 1} • ${leaderboard.total || 0} membres`,
          iconURL: interaction.guild.iconURL(),
        })
        .setTimestamp();

      // Boutons de navigation
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`page_${type}_${Math.max(1, page - 1)}`)
          .setLabel('◀️ Précédent')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId(`refresh_${type}_${page}`)
          .setLabel('🔄 Actualiser')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`page_${type === 'money' ? 'xp' : 'money'}_1`)
          .setLabel(`Voir ${type === 'money' ? 'Niveaux' : 'Argent'}`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`page_${type}_${page + 1}`)
          .setLabel('Suivant ▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= (leaderboard.pages || 1))
      );

      await respond({
        embeds: [embed],
        components: [buttons],
        flags: 1 << 6,
      }).catch(() => {});
    } catch (error) {
      logger.error("Erreur lors de l'affichage du classement:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Erreur')
        .setDescription('Une erreur est survenue lors du chargement du classement.')
        .setTimestamp();

      await respond({
        embeds: [errorEmbed],
        components: [],
        flags: 1 << 6,
      }).catch(() => {});
    }
  },
};
