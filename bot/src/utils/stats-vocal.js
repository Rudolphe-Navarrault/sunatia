const GuildConfig = require('../models/GuildConfig');
const logger = require('../utils/logger');

/**
 * Met à jour le salon vocal affichant le nombre de membres du serveur
 * @param {import('discord.js').Guild} guild
 */
async function updateMemberCount(guild) {
  try {
    const config = await GuildConfig.findOne({ guildId: guild.id });
    if (!config || !config.memberCountChannelId) {
      logger.info(`ℹ️ Aucun salon de statistiques configuré pour ce serveur: ${guild.name}`);
      return;
    }

    let channel = guild.channels.cache.get(config.memberCountChannelId);
    if (!channel) {
      logger.warn(`⚠️ Salon non trouvé dans le cache pour ${guild.name}, tentative de fetch...`);
      try {
        channel = await guild.channels.fetch(config.memberCountChannelId);
      } catch {
        logger.error(
          `❌ Impossible de récupérer le salon pour ${guild.name}. Suppression de la config.`
        );
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

/**
 * Initialise tous les salons de compteur de membres pour tous les serveurs du bot
 * @param {import('discord.js').Client} client
 */
async function initializeStatsChannels(client) {
  client.guilds.cache.forEach(async (guild) => {
    await updateMemberCount(guild);
  });
}

module.exports = {
  updateMemberCount,
  initializeStatsChannels, // <-- ajouté
};
