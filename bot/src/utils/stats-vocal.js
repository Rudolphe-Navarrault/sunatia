const GuildConfig = require('../models/GuildConfig');
const logger = require('./logger');

async function updateMemberCount(guild) {
  try {
    const config = await GuildConfig.findOne({ guildId: guild.id });
    if (!config?.memberCountChannelId) return;

    await guild.members.fetch(); // pour être sûr du memberCount exact
    let channel = guild.channels.cache.get(config.memberCountChannelId);

    if (!channel) {
      try {
        channel = await guild.channels.fetch(config.memberCountChannelId);
      } catch {
        logger.error(`❌ Impossible de récupérer le salon pour ${guild.name}, suppression config`);
        await GuildConfig.deleteOne({ guildId: guild.id });
        return;
      }
    }

    const newName = `👥 Membres : ${guild.memberCount}`;
    if (channel.name !== newName) {
      await channel.setName(newName);
      logger.info(`✅ Salon mis à jour: ${newName} (${guild.name})`);
    }
  } catch (err) {
    logger.error(`❌ Erreur updateMemberCount pour ${guild.name}:`, err);
  }
}

async function initializeStatsChannels(client) {
  for (const guild of client.guilds.cache.values()) {
    await updateMemberCount(guild);
  }
  logger.info('📊 Compteurs membres initialisés');
}

module.exports = { updateMemberCount, initializeStatsChannels };
