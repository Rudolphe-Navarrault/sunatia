require('dotenv').config();

// Détection de l'environnement
const isDev = process.env.NODE_ENV === 'development';

// Log de l'environnement
console.log(`🚀 Démarrage en mode ${isDev ? 'développement' : 'production'}`);
console.log(`🔗 Base de données: ${isDev ? process.env.MONGO_URI_DEV : process.env.MONGO_URI}`);

module.exports = {
  // Configuration Discord
  discord: {
    token: isDev
      ? process.env.DISCORD_TOKEN_DEV // strictement dev
      : process.env.DISCORD_TOKEN, // strictement prod
    clientId: isDev ? process.env.CLIENT_ID_DEV : process.env.CLIENT_ID,
    guildId: isDev
      ? process.env.DEV_GUILD_ID || null // pour dev, obligatoire
      : null, // prod : null pour déploiement global
    // Intents nécessaires
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent'],
    // Permissions requises
    permissions: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'ReadMessageHistory'],
  },

  // Configuration MongoDB
  mongo: {
    uri: isDev ? process.env.MONGO_URI_DEV : process.env.MONGO_URI,
    options: {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
    },
  },

  // Paramètres de performance
  performance: {
    memberBatchSize: 1000, // Taille des lots pour le traitement des membres
    updateInterval: 3600000, // Intervalle de mise à jour des membres en ms (1h)
  },
};
