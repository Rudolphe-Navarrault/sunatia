const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const Currency = require('../../models/Currency');
const XP = require('../../models/XP');
const User = require('../../models/User');
const logger = require('../../utils/logger');

const ITEMS_PER_PAGE = 10;
const LEADERBOARD_CACHE = new Map();

function getCacheKey(type, guildId, page) {
  return `${type}_${guildId}_${page}`;
}

// Nettoyage du cache toutes les heures
function cleanCache() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  for (const [key, data] of LEADERBOARD_CACHE.entries()) {
    if (now - data.timestamp > oneHour) LEADERBOARD_CACHE.delete(key);
  }
}
setInterval(cleanCache, 60 * 60 * 1000);

async function displayLeaderboard(interaction, type, page = 1, forceRefresh = false) {
  try {
    if (!interaction?.guildId) return;

    const guildId = interaction.guildId;
    const cacheKey = getCacheKey(type, guildId, page);

    if (forceRefresh) LEADERBOARD_CACHE.delete(cacheKey);

    let leaderboard = LEADERBOARD_CACHE.get(cacheKey)?.data;

    if (!leaderboard) {
      // Récupération des données selon le type
      const skip = (page - 1) * ITEMS_PER_PAGE;
      let totalUsers = 0;
      let users = [];

      if (type === 'money') {
        totalUsers = await Currency.countDocuments({ guildId });
        users = await Currency.find({ guildId })
          .sort({ balance: -1 })
          .skip(skip)
          .limit(ITEMS_PER_PAGE)
          .lean();
      } else {
        totalUsers = await XP.countDocuments({ guildId });
        users = await XP.find({ guildId })
          .sort({ level: -1, xp: -1 })
          .skip(skip)
          .limit(ITEMS_PER_PAGE)
          .lean();
      }

      const totalPages = Math.max(1, Math.ceil(totalUsers / ITEMS_PER_PAGE));

      if (page > totalPages) {
        return interaction.reply({
          content: `❌ La page ${page} n'existe pas. Il y a ${totalPages} page(s) disponible(s).`,
          ephemeral: true,
        });
      }

      leaderboard = { users, total: totalUsers, pages: totalPages, type };
      LEADERBOARD_CACHE.set(cacheKey, { data: leaderboard, timestamp: Date.now() });
    }

    if (!leaderboard.users.length) {
      const noDataEmbed = new EmbedBuilder()
        .setColor('#ff9900')
        .setDescription('Aucun classement disponible pour le moment.');
      return interaction[interaction.replied || interaction.deferred ? 'editReply' : 'reply']({
        embeds: [noDataEmbed],
        components: [],
        ephemeral: true,
      });
    }

    // Récupération des usernames
    const usersWithNames = await Promise.all(
      leaderboard.users.map(async (user, index) => {
        const position = (page - 1) * ITEMS_PER_PAGE + index + 1;
        const medal =
          position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`;

        const userData = await User.findOne({ userId: user.userId, guildId }).lean();
        const username = userData?.username || 'Utilisateur inconnu';

        if (leaderboard.type === 'money') {
          return `${medal} **${username}** - ${user.balance || 0} <:coin:1240070496038350919>`;
        } else {
          return `${medal} **${username}** - Niveau ${user.level || 1} (${user.xp || 0} XP)`;
        }
      })
    );

    // Embed principal
    const embedTitle =
      leaderboard.type === 'money' ? '🏆 Classement des plus riches' : '🏆 Classement des niveaux';
    const embed = new EmbedBuilder()
      .setColor('#00ff9d')
      .setTitle(`${embedTitle} - Page ${page}/${leaderboard.pages}`)
      .setDescription(usersWithNames.join('\n'))
      .setFooter({
        text: `Page ${page}/${leaderboard.pages} • ${leaderboard.total} membres`,
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
        .setLabel(type === 'money' ? 'Voir Niveaux' : 'Voir Argent')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`page_${type}_${page + 1}`)
        .setLabel('Suivant ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= leaderboard.pages)
    );

    const responseOptions = { embeds: [embed], components: [buttons], ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(responseOptions);
    } else {
      await interaction.reply(responseOptions);
    }
  } catch (error) {
    logger.error("Erreur lors de l'affichage du leaderboard:", error);
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors du chargement du classement.')
      .setTimestamp();
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
    }
  }
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
  execute: async (interaction) => {
    const type = interaction.options.getString('type');
    const page = Math.max(1, interaction.options.getInteger('page') || 1);
    const forceRefresh = interaction.options.getBoolean('force_refresh') || false;
    await displayLeaderboard(interaction, type, page, forceRefresh);
  },
  displayLeaderboard,
  LEADERBOARD_CACHE,
};
