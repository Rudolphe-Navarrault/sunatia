// Cache simple pour les XP
const xpCache = new Map();

/**
 * stocke dans le cache
 * @param {string} guildId
 * @param {string} userId
 * @param {object} data
 */
function set(guildId, userId, data) {
  if (!xpCache.has(guildId)) xpCache.set(guildId, new Map());
  xpCache.get(guildId).set(userId, data);
}

/**
 * récupère depuis le cache
 * @param {string} guildId
 * @param {string} userId
 * @returns {object|null}
 */
function get(guildId, userId) {
  return xpCache.get(guildId)?.get(userId) || null;
}

/**
 * Supprime une entrée du cache
 */
function del(guildId, userId) {
  xpCache.get(guildId)?.delete(userId);
}

module.exports = { set, get, del };
