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
        // Force fetch pour que memberCount soit exact
        await guild.members.fetch();
        await updateMemberCount(guild);
      } catch (err) {
        logger.error(`Erreur lors de la mise à jour du compteur pour ${guild.name}:`, err);
      } finally {
        guildUpdateTimers.delete(guild.id);
      }
    }, 1000)
  ); // délai 1 seconde pour éviter trop de mises à jour
}

/**
 * Initialise tous les compteurs de membres pour tous les serveurs du bot
 * @param {import('discord.js').Client} client
 */
async function initializeStatsChannels(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const config = await GuildConfig.findOne({ guildId: guild.id });
      if (!config || !config.memberCountChannelId) {
        logger.info(`ℹ️ Pas de config trouvée pour ${guild.name} (${guild.id})`);
        continue;
      }

      logger.info(
        `✅ Config trouvée pour ${guild.name} (${guild.id}) → Salon ${config.memberCountChannelId}`
      );

      scheduleUpdate(guild);
    } catch (err) {
      logger.error(`❌ Erreur lors de l'init stats pour ${guild.name}:`, err);
    }
  }
}

module.exports = {
  updateMemberCount,
  scheduleUpdate,
  initializeStatsChannels,
};
