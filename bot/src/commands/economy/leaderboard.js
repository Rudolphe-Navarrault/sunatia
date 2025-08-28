const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const mongoose = require('mongoose');
const Currency = require('../../models/Currency');
const XP = require('../../models/XP');
const User = require('../../models/User');
const logger = require('../../utils/logger');

const ITEMS_PER_PAGE = 10;
const LEADERBOARD_ID = 'leaderboard';
const LEADERBOARD_CACHE = new Map();

function getCacheKey(type, guildId, page) {
  return `${type}_${guildId}_${page}`;
}

function cleanCache() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  for (const [key, data] of LEADERBOARD_CACHE.entries()) {
    if (now - data.timestamp > oneHour) LEADERBOARD_CACHE.delete(key);
  }
}
setInterval(cleanCache, 60 * 60 * 1000);

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
    try {
      // Gestion des interactions de bouton
      if (interaction.isButton()) {
        const [action, type, pageStr] = interaction.customId.split('_');
        const page = parseInt(pageStr) || 1;

        if (action === 'refresh') {
          await this.displayLeaderboard(interaction, type, page, true);
        } else if (action === 'page') {
          await this.displayLeaderboard(interaction, type, page, false);
        } else {
          return interaction.reply({
            content: '❌ Commande invalide. Veuillez réessayer.',
            ephemeral: true,
          });
        }
        return;
      }

      // Récupération des options
      const type = interaction.options.getString('type');
      const page = Math.max(1, interaction.options.getInteger('page') || 1);
      const forceRefresh = interaction.options.getBoolean('force_refresh') || false;

      await this.displayLeaderboard(interaction, type, page, forceRefresh);
    } catch (error) {
      logger.error('Erreur dans la commande leaderboard :', error);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: "❌ Une erreur est survenue lors de l'exécution de la commande.",
          ephemeral: true,
        });
      } else {
        return interaction.editReply({
          content: '❌ Une erreur est survenue lors de la mise à jour du classement.',
          ephemeral: true,
        });
      }
    }
  },

  async displayLeaderboard(interaction, type, page = 1, forceRefresh = false) {
    try {
      // Utiliser le guildId du serveur
      const guildId = interaction.guild.id;
      console.log(`[LEADERBOARD] Utilisation du guildId: ${guildId} (${typeof guildId})`);

      const skip = (page - 1) * ITEMS_PER_PAGE;
      const cacheKey = getCacheKey(type, guildId, page);

      // Vérifier que le modèle est bien chargé
      console.log('[LEADERBOARD] Modèle Currency:', Currency ? 'chargé' : 'non chargé');
      if (Currency) {
        console.log('[LEADERBOARD] Schéma Currency:', Object.keys(Currency.schema.paths));
      }

      console.log(
        `[LEADERBOARD] Affichage du classement - Type: ${type}, Page: ${page}, GuildID: ${guildId}`
      );

      // Forcer le rafraîchissement si demandé
      if (forceRefresh) {
        console.log('[LEADERBOARD] Rafraîchissement forcé du cache');
        LEADERBOARD_CACHE.delete(cacheKey);
      }

      // Vérifier le cache
      let leaderboard = LEADERBOARD_CACHE.get(cacheKey)?.data;

      if (leaderboard) {
        console.log(`[LEADERBOARD] Données récupérées depuis le cache`);
      }

      if (!leaderboard) {
        console.log(`[LEADERBOARD] Aucun cache trouvé, requête en base de données...`);

        // Récupérer les données depuis la base de données
        if (type === 'money') {
          console.log(
            `[LEADERBOARD] Recherche des utilisateurs avec guildId: ${guildId} (type: ${typeof guildId}) dans la collection Currency`
          );
          console.log(
            `[LEADERBOARD] Vérification du type de guildId:`,
            guildId,
            'type:',
            typeof guildId
          );

          // Vérifier la connexion à la base de données
          const dbStatus = mongoose.connection.readyState;
          console.log(
            `[LEADERBOARD] Statut de la connexion MongoDB: ${dbStatus} (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)`
          );

          try {
            // Afficher les informations sur la base de données
            const db = mongoose.connection.db;
            const dbName = db.databaseName;
            console.log(`[LEADERBOARD] Base de données connectée: ${dbName}`);

            // Afficher les collections disponibles
            const collections = await db.listCollections().toArray();
            console.log(
              `[LEADERBOARD] Collections disponibles:`,
              collections.map((c) => c.name)
            );

            // Vérifier si la collection currencies existe
            const collectionExists = collections.some((c) => c.name === 'currencies');
            console.log(`[LEADERBOARD] Collection 'currencies' existe: ${collectionExists}`);

            // Vérifier les documents sans filtre
            const allDocsCount = await Currency.countDocuments({});
            console.log(`[LEADERBOARD] Nombre total de documents dans currencies: ${allDocsCount}`);

            // Vérifier les premiers documents sans filtre
            const allDocsSample = await Currency.find({}).limit(3).lean();
            console.log(
              `[LEADERBOARD] Exemple de documents (sans filtre):`,
              JSON.stringify(allDocsSample, null, 2)
            );

            // Vérifier avec le guildId spécifique (avec requête brute)
            const totalUsers = await Currency.countDocuments({ guildId: guildId });
            console.log(
              `[LEADERBOARD] Nombre d'utilisateurs avec guildId=${guildId}: ${totalUsers}`
            );

            // Vérifier avec une requête directe sur la collection
            const collection = mongoose.connection.db.collection('currencies');
            const directQuery = await collection.find({ guildId: guildId }).limit(3).toArray();
            console.log(
              `[LEADERBOARD] Requête directe (collection):`,
              JSON.stringify(directQuery, null, 2)
            );

            // Vérifier avec une requête sans filtre
            const allDocs = await Currency.find({}).limit(3).lean();
            console.log(`[LEADERBOARD] Tous les documents:`, JSON.stringify(allDocs, null, 2));

            // Vérifier si le schéma a un champ guildId
            const schemaPaths = Object.keys(Currency.schema.paths);
            console.log(`[LEADERBOARD] Champs du schéma Currency:`, schemaPaths);

            const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE) || 1;
            console.log(`[LEADERBOARD] Nombre total de pages: ${totalPages}`);
          } catch (error) {
            console.error(
              '[LEADERBOARD] Erreur lors de la vérification de la base de données:',
              error
            );
            throw error;
          }

          // Vérifier que la page demandée est valide
          if (page > totalPages && totalPages > 0) {
            return interaction.reply({
              content: `❌ La page ${page} n'existe pas. Il y a ${totalPages} page(s) disponible(s).`,
              ephemeral: true,
            });
          }

          // Vérifier d'abord la connexion à la base de données
          console.log(`[LEADERBOARD] Connexion MongoDB:`, mongoose.connection.readyState);

          // Vérifier si la collection existe
          const collections = await mongoose.connection.db
            .listCollections({ name: 'currencies' })
            .toArray();
          console.log(`[LEADERBOARD] Collection currencies existe:`, collections.length > 0);

          // Compter tous les documents dans la collection
          const totalCount = await mongoose.connection.db.collection('currencies').countDocuments();
          console.log(`[LEADERBOARD] Nombre total de documents dans currencies:`, totalCount);

          // Récupérer les utilisateurs triés par solde décroissant
          console.log(
            `[LEADERBOARD] Récupération des utilisateurs - skip: ${skip}, limit: ${ITEMS_PER_PAGE}`
          );

          // Utiliser la collection directement pour la requête
          const collection = mongoose.connection.db.collection('currencies');

          // Compter les documents correspondants
          const count = await collection.countDocuments({ guildId });
          console.log(`[LEADERBOARD] Nombre de documents avec guildId=${guildId}:`, count);

          // Afficher des exemples de documents correspondants
          const sample = await collection.find({ guildId }).limit(3).toArray();
          console.log(
            `[LEADERBOARD] Exemples de documents correspondants:`,
            JSON.stringify(sample, null, 2)
          );

          // Exécuter la requête finale avec la collection directement
          const topUsers = await collection
            .find({ guildId })
            .sort({ balance: -1 })
            .skip(skip)
            .limit(ITEMS_PER_PAGE)
            .toArray();

          console.log(`[LEADERBOARD] Utilisateurs récupérés:`, topUsers.length);

          // Transformer les résultats pour correspondre au format attendu
          const formattedUsers = topUsers.map((doc) => ({
            userId: doc.userId,
            guildId: doc.guildId,
            balance: doc.balance,
            lastDaily: doc.lastDaily,
          }));

          leaderboard = {
            users: formattedUsers,
            total: count,
            pages: totalPages,
            type: 'money',
          };
        } else {
          // Type XP
          const totalUsers = await XP.countDocuments({ guildId });
          const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE) || 1;

          // Vérifier que la page demandée est valide
          if (page > totalPages && totalPages > 0) {
            return interaction.reply({
              content: `❌ La page ${page} n'existe pas. Il y a ${totalPages} page(s) disponible(s).`,
              ephemeral: true,
            });
          }

          // Récupérer les utilisateurs triés par niveau puis XP décroissants
          const topUsers = await XP.find({ guildId })
            .sort({ level: -1, xp: -1 })
            .skip(skip)
            .limit(ITEMS_PER_PAGE)
            .lean();

          leaderboard = {
            users: topUsers,
            total: totalUsers,
            pages: totalPages,
            type: 'xp',
          };
        }

        // Mettre en cache les résultats
        LEADERBOARD_CACHE.set(cacheKey, { data: leaderboard, timestamp: Date.now() });
      }

      // Si aucun utilisateur trouvé
      if (!leaderboard.users || leaderboard.users.length === 0) {
        console.log(
          `[DEBUG] Aucun utilisateur trouvé dans le classement. Vérification des collections...`
        );

        // Vérifier les collections existantes
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(
          '[DEBUG] Collections disponibles:',
          collections.map((c) => c.name)
        );

        // Vérifier les documents dans Currency
        const allCurrencies = await Currency.find({}).limit(5).lean();
        console.log(
          '[DEBUG] Exemple de documents dans Currency:',
          JSON.stringify(allCurrencies, null, 2)
        );

        const noDataEmbed = new EmbedBuilder()
          .setColor('#ff9900')
          .setDescription('Aucun classement disponible pour le moment.');

        return interaction[interaction.replied || interaction.deferred ? 'editReply' : 'reply']({
          embeds: [noDataEmbed],
          components: [],
          ephemeral: true,
        }).catch(() => {});
      }

      // Récupérer les noms d'utilisateurs
      const usersWithNames = await Promise.all(
        leaderboard.users.map(async (user, index) => {
          const position = (page - 1) * ITEMS_PER_PAGE + index + 1;
          const medal =
            position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`;

          // Récupérer les informations utilisateur depuis la base de données
          const userData = await User.findOne({ userId: user.userId, guildId }).lean();
          const username = userData?.username || 'Utilisateur inconnu';

          // Formater la ligne du classement selon le type
          if (leaderboard.type === 'money') {
            return `${medal} **${username}** - ${user.balance || 0} <:coin:1240070496038350919>`;
          } else {
            return `${medal} **${username}** - Niveau ${user.level || 1} (${user.xp || 0} XP)`;
          }
        })
      );

      // Créer l'embed
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

      // Créer les boutons de navigation
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

      // Envoyer ou mettre à jour le message
      const responseOptions = {
        embeds: [embed],
        components: [buttons],
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(responseOptions).catch(() => {});
      } else {
        await interaction.reply(responseOptions).catch(() => {});
      }
    } catch (error) {
      logger.error("Erreur lors de l'affichage du classement:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('❌ Erreur')
        .setDescription('Une erreur est survenue lors du chargement du classement.')
        .setTimestamp();

      if (interaction.replied || interaction.deferred) {
        await interaction
          .editReply({
            embeds: [errorEmbed],
            components: [],
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            embeds: [errorEmbed],
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  },
};
