const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    logger.info(`✅ Connecté en tant que ${client.user.tag}!`);
    logger.info('ℹ️  Les commandes sont gérées via le script deploy-commands.js');
    logger.info('🔧 Pour mettre à jour les commandes, utilisez:');
    logger.info('   - En développement: npm run deploy-commands-dev');
    logger.info('   - En production: npm run deploy-commands-prod');
  },
};
