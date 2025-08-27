const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const xpController = require('../../controllers/xpController');
const User = require('../../models/User'); // ← Récupérer les infos utilisateur
const logger = require('../../utils/logger');

const ITEMS_PER_PAGE = 10;
const LEADERBOARD_ID = 'leaderboard';
const LEADERBOARD_CACHE = new Map();

function getCacheKey(guildId, page) {
  return `${guildId}_${page}`;
}

function cleanCache() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  for (const [key, data] of LEADERBOARD_CACHE.entries()) {
    if (now - data.timestamp > oneHour) LEADERBOARD_CACHE.delete(key);
  }
}
setInterval(cleanCache, 60 * 60 * 1000);

async function displayLeaderboard(interaction, page = 1, isButton = false, forceRefresh = false) {
  try {
    if (!interaction?.guildId) return;

    const guildId = interaction.guildId;
    const cacheKey = getCacheKey(guildId, page);

    // ✅ Forcer le rafraîchissement
    if (forceRefresh) LEADERBOARD_CACHE.delete(cacheKey);

    let leaderboard = LEADERBOARD_CACHE.get(cacheKey)?.data;

    if (!leaderboard) {
      leaderboard = await xpController.getLeaderboard(guildId, page, ITEMS_PER_PAGE);
      LEADERBOARD_CACHE.set(cacheKey, { data: leaderboard, timestamp: Date.now() });
    }

    if (!leaderboard.users.length) {
      const noDataEmbed = new EmbedBuilder()
        .setColor('#ff9900')
        .setDescription('Aucun classement disponible pour le moment.');
      return interaction[isButton ? 'update' : 'editReply']({
        embeds: [noDataEmbed],
        components: [],
      }).catch(() => {});
    }

    // Récupérer les usernames depuis la collection User
    const usersWithNames = await Promise.all(
      leaderboard.users.map(async (user, index) => {
        const position = (page - 1) * ITEMS_PER_PAGE + index + 1;
        const medal =
          position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`;

        const userData = await User.findOne({ userId: user.userId, guildId }).lean();
        const username = userData?.username || 'Utilisateur inconnu';

        return `${medal} **${username}** - Niveau ${user.level || 1} (${user.xp || 0} XP)`;
      })
    );

    const embed = new EmbedBuilder()
      .setColor('#00ff9d')
      .setTitle(`🏆 Classement - Page ${page}/${leaderboard.pages || 1}`)
      .setDescription(usersWithNames.join('\n'))
      .setFooter({
        text: `Page ${page}/${leaderboard.pages || 1} • ${leaderboard.total || 0} membres`,
      })
      .setTimestamp();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${LEADERBOARD_ID}_prev_${page}`)
        .setLabel('◀️ Précédent')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page <= 1),
      new ButtonBuilder()
        .setCustomId(`${LEADERBOARD_ID}_refresh_${page}`)
        .setLabel('🔄 Actualiser')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${LEADERBOARD_ID}_next_${page}`)
        .setLabel('Suivant ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= (leaderboard.pages || 1))
    );

    const responseOptions = { embeds: [embed], components: [buttons], withResponse: true };
    if (isButton)
      return interaction[interaction.replied || interaction.deferred ? 'editReply' : 'update'](
        responseOptions
      ).catch(() => {});
    return interaction[interaction.replied || interaction.deferred ? 'editReply' : 'reply'](
      responseOptions
    ).catch(() => {});
  } catch (error) {
    logger.error("Erreur lors de l'affichage du classement:", error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Affiche le classement des membres du serveur')
    .addIntegerOption((option) =>
      option.setName('page').setDescription('Numéro de page').setMinValue(1)
    )
    .addBooleanOption((option) =>
      option.setName('force_refresh').setDescription('Forcer le rafraîchissement')
    ),
  execute: async (interaction) => {
    const page = Math.max(1, interaction.options?.getInteger('page') || 1);
    const forceRefresh = true; // Forcer l’actualisation
    await displayLeaderboard(interaction, page, false, forceRefresh);
  },
  displayLeaderboard,
  LEADERBOARD_CACHE,
};
