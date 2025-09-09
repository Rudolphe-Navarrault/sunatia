const GuildConfig = require('../models/GuildConfig');
const logger = require('../utils/logger');

// Map pour éviter les mises à jour trop rapides
const guildUpdateTimers = new Map();

/**
 * Met à jour le salon vocal affichant le nombre de membres du serveur
 * @param {import('discord.js').Guild} guild
 */
async function updateMemberCount(guild) {
  try {
    const config = await GuildConfig.findOne({ guildId: guild.id });
    if (!config || !config.memberCountChannelId) {
      logger.info(`ℹ️ Aucun salon de statistiques configuré pour le serveur: ${guild.name}`);
      return;
    }

    // Fetch complet pour que memberCount soit exact
    await guild.members.fetch();

    let channel = guild.channels.cache.get(config.memberCountChannelId);
    if (!channel) {
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
 * Planifie la mise à jour du compteur avec debounce
 * @param {import('discord.js').Guild} guild
 */
function scheduleUpdate(guild) {
  if (guildUpdateTimers.has(guild.id)) return;

  guildUpdateTimers.set(
    guild.id,
    setTimeout(async () => {
      try {
        await updateMemberCount(guild);
      } catch (err) {
        logger.error(`Erreur lors de la mise à jour du compteur pour ${guild.name}:`, err);
      } finally {
        guildUpdateTimers.delete(guild.id);
      }
    }, 1000)
  );
}

/**
 * Initialise tous les compteurs de membres pour tous les serveurs du bot
 * @param {import('discord.js').Client} client
 */
async function initializeStatsChannels(client) {
  logger.info('📊 Compteurs membres initialisés');
  client.guilds.cache.forEach((guild) => {
    scheduleUpdate(guild);
  });
}

module.exports = {
  updateMemberCount,
  scheduleUpdate,
  initializeStatsChannels,
};
