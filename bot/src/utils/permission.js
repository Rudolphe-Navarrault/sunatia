const User = require('../models/User');
const Group = require('../models/Group');
const CommandPerm = require('../models/CommandPerm');
const Permission = require('../models/Permission');

/**
 * Invalide le cache utilisateur
 */
function invalidateUserCache(guildId, userId) {
  // Ici tu peux mettre ton système de cache si tu en as
}

/**
 * Invalide le cache de groupe
 */
function invalidateGroupCache(guildId, groupName) {}

/**
 * Invalide le cache de commande
 */
function invalidateCommandCache(guildId, command) {}

/**
 * Vérifie si une permission existe
 */
async function permissionExists(permission) {
  if (!permission) return false;
  const perm = await Permission.findOne({ name: permission.toLowerCase() });
  return !!perm;
}

/**
 * Vérifie si un utilisateur a une permission
 */
async function userHasPermission(guildId, userId, permission) {
  const user = await User.findOne({ guildId, userId });
  if (user?.permissions.map((p) => p.toLowerCase()).includes(permission.toLowerCase())) return true;

  const groups = await Group.find({ guildId });
  for (const g of groups) {
    if (
      g.members?.includes(userId) &&
      g.permissions.map((p) => p.toLowerCase()).includes(permission.toLowerCase())
    )
      return true;
  }

  return false;
}

/**
 * Vérifie si un groupe a une permission
 */
async function groupHasPermission(guildId, groupName, permission) {
  const group = await Group.findOne({
    guildId,
    name: { $regex: `^${groupName}$`, $options: 'i' },
  });
  if (!group) return false;
  return group.permissions.map((p) => p.toLowerCase()).includes(permission.toLowerCase());
}

/**
 * Vérifie si un utilisateur peut exécuter une commande
 */
async function hasCommandPermission(guildId, userId, command) {
  const cmdPerm = await CommandPerm.findOne({ guildId, command });
  if (!cmdPerm) return true; // Si aucune permission définie, tout le monde peut

  const { permissions } = cmdPerm;
  for (const perm of permissions) {
    const has = await userHasPermission(guildId, userId, perm);
    if (has) return true;
  }
  return false;
}

module.exports = {
  invalidateUserCache,
  invalidateGroupCache,
  invalidateCommandCache,
  permissionExists,
  userHasPermission,
  groupHasPermission,
  hasCommandPermission,
};
