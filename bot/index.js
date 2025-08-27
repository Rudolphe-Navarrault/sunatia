require('dotenv').config();
const SunatiaBot = require('./src/bot');
const logger = require('./src/utils/logger');

// Créer une instance du bot
const client = new SunatiaBot();

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  logger.error('❌ Exception non gérée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Rejet de promesse non géré:', reason, promise);
});

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

// Démarrage du bot
(async () => {
  try {
    await client.start();
    logger.info(`🚀 Bot connecté en tant que ${client.user.tag}`);
  } catch (error) {
    logger.error('❌ Erreur critique lors du démarrage du bot:', error);
    process.exit(1);
  }
})();

module.exports = client;
