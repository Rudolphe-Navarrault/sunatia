require('dotenv').config();
const express = require('express');
const SunatiaBot = require('./src/bot');
const logger = require('./src/utils/logger');

const isDev = process.env.NODE_ENV === 'development';
const PORT = process.env.PORT || 3000;

console.log('='.repeat(80));
logger.info(`🚀 Démarrage en mode ${isDev ? 'développement' : 'production'}`);
logger.info(`📅 ${new Date().toISOString()}`);

// Vérification des variables d'environnement
const requiredEnvVars = isDev
  ? ['DISCORD_TOKEN_DEV', 'CLIENT_ID_DEV', 'MONGO_URI_DEV', 'DEV_GUILD_ID']
  : ['DISCORD_TOKEN', 'CLIENT_ID', 'MONGO_URI'];

const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  logger.error(`❌ Variables d'environnement manquantes: ${missingVars.join(', ')}`);
  process.exit(1);
}

const app = express();

// Création du bot
const client = new SunatiaBot({
  isDev,
  devGuildId: isDev ? process.env.DEV_GUILD_ID : null,
});

// Gestion des erreurs globales
process.on('uncaughtException', (error) => logger.error('❌ Exception non gérée:', error));
process.on('unhandledRejection', (reason, promise) =>
  logger.error('❌ Rejet de promesse non géré:', reason, promise)
);

// Gestion des signaux d'arrêt
['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`⚠️ Reçu signal ${signal}, arrêt du bot...`);
    try {
      await client.shutdown();
      logger.info('✅ Bot arrêté correctement.');
      process.exit(0);
    } catch (err) {
      logger.error('❌ Erreur lors de l’arrêt du bot:', err);
      process.exit(1);
    }
  });
});

// Démarrage du bot et serveur HTTP
(async () => {
  try {
    await client.start();
    logger.info(`🚀 Bot connecté en tant que ${client.user.tag}`);
  } catch (error) {
    logger.error('❌ Erreur critique lors du démarrage du bot:', error);
    process.exit(1);
  }

  app.get('/', (req, res) => res.send('Sunatia Bot en ligne !'));
  app.listen(PORT, () => logger.info(`🌐 Serveur HTTP lancé sur le port ${PORT}`));
})();

module.exports = client;
