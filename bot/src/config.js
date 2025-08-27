require('dotenv').config();

module.exports = {
  // Configuration Discord
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    // Intents nécessaires
    intents: [
      'Guilds',
      'GuildMembers',
      'GuildMessages',
      'MessageContent'
    ],
    // Permissions requises
    permissions: [
      'ViewChannel',
      'SendMessages',
      'EmbedLinks',
      'ReadMessageHistory'
    ]
  },
  // Configuration MongoDB
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/sunatia-bot',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  // Paramètres de performance
  performance: {
    memberBatchSize: 1000, // Taille des lots pour le traitement des membres
    updateInterval: 3600000 // Intervalle de mise à jour des membres en ms (1h)
  }
};
