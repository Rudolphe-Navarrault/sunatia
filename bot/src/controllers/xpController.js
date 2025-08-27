const XP = require('../models/XP');
const { GuildSettings } = require('../models/GuildSettings');
const logger = require('../utils/logger');

class XPController {
  constructor() {
    this.cache = new Map();
  }

  calculateLevel(xp) {
    const level = Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
    const xpForNextLevel = Math.pow(level, 2) * 100;
    const xpForCurrentLevel = Math.pow(level - 1, 2) * 100;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    const xpProgress = xp - xpForCurrentLevel;

    return {
      level,
      xpForNextLevel,
      xpForCurrentLevel,
      xpNeeded,
      xpProgress,
      progressPercentage: Math.min(Math.round((xpProgress / xpNeeded) * 100), 100),
    };
  }

  async getProfile(userId, guildId) {
    try {
      const cacheKey = `${userId}:${guildId}`;
      if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

      let profile = await XP.findOne({ userId, guildId });
      if (!profile) {
        profile = new XP({ userId, guildId, xp: 0, level: 1, lastXpGain: new Date() });
        await profile.save();
      }

      this.cache.set(cacheKey, profile);
      return profile;
    } catch (error) {
      logger.error('Erreur lors de la récupération du profil XP:', error);
      throw error;
    }
  }

  async addXp(userId, guildId, amount) {
    if (amount <= 0) throw new Error("Le montant d'XP doit être positif");

    try {
      const profile = await this.getProfile(userId, guildId);
      const oldLevel = profile.level;

      profile.xp += amount;
      const newLevel = this.calculateLevel(profile.xp).level;
      const leveledUp = newLevel > oldLevel;

      if (leveledUp) profile.level = newLevel;
      profile.lastXpGain = new Date();
      await profile.save();

      const cacheKey = `${userId}:${guildId}`;
      this.cache.set(cacheKey, profile);

      return {
        ...this.calculateLevel(profile.xp),
        xp: profile.xp,
        level: profile.level,
        leveledUp,
        userId,
        guildId,
      };
    } catch (error) {
      logger.error("Erreur lors de l'ajout d'XP:", error);
      throw error;
    }
  }

  async getLeaderboard(guildId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const users = await XP.find({ guildId })
        .sort({ xp: -1, level: -1, lastXpGain: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await XP.countDocuments({ guildId });
      const pages = Math.ceil(total / limit);

      return { users, total, pages };
    } catch (error) {
      logger.error('Erreur lors de la récupération du classement:', error);
      return { users: [], total: 0, pages: 1 };
    }
  }

  // --- NOUVEAU : récupérer le rang d’un utilisateur ---
  async getUserRank(userId, guildId) {
    try {
      const allUsers = await XP.find({ guildId }).sort({ xp: -1, level: -1, lastXpGain: 1 }).lean();

      const total = allUsers.length;
      const userData = allUsers.find((u) => u.userId === userId);
      if (!userData) return null;

      const position = allUsers.findIndex((u) => u.userId === userId) + 1;
      const { level, xpProgress, xpNeeded, progressPercentage } = this.calculateLevel(userData.xp);

      return {
        userId,
        level,
        xp: userData.xp,
        position,
        total,
        xpProgress,
        xpNeeded,
        progressPercentage,
      };
    } catch (error) {
      logger.error("Erreur lors de la récupération du rang de l'utilisateur:", error);
      return null;
    }
  }

  clearCache(userId, guildId) {
    if (userId && guildId) {
      this.cache.delete(`${userId}:${guildId}`);
      logger.debug(`[Cache] Cache vidé pour l'utilisateur ${userId} (${guildId})`);
    } else {
      this.cache.clear();
      logger.debug('[Cache] Cache XP entièrement vidé');
    }
  }

  // --- GUILD SETTINGS ---
  async getGuildSettings(guildId) {
    let settings = await GuildSettings.findOne({ guildId }).lean();
    if (!settings) {
      settings = await GuildSettings.create({
        guildId,
        xpEnabled: true,
        xpChannel: null,
        leveling: {
          channelId: null,
          levelUpMessage: '{user} a atteint le niveau {level} !',
          xpPerMessage: { min: 5, max: 10 },
          cooldown: 60,
          blacklistedChannels: [],
          blacklistedRoles: [],
        },
      });
    }
    return settings;
  }

  async updateGuildSettings(guildId, update) {
    try {
      return await GuildSettings.findOneAndUpdate(
        { guildId },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      logger.error('Erreur lors de la mise à jour des paramètres du serveur:', error);
      throw error;
    }
  }
}

module.exports = new XPController();
