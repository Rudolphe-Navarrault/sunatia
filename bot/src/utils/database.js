const mongoose = require("mongoose");
const config = require("../config");
const User = require("../models/User");

class Database {
  constructor() {
    this.mongoose = mongoose;
    this.models = { User };
    this.User = User;
    this.isConnected = false;
  }

  /** Connexion à MongoDB */
  async connect() {
    if (this.isConnected) return;

    try {
      await mongoose.connect(config.mongo.uri, config.mongo.options);
      this.isConnected = true;
      console.log("✅ Connecté à MongoDB");

      // Vérification et création des index
      await this.ensureIndexes();
    } catch (error) {
      console.error("❌ Erreur de connexion à MongoDB:", error);
      process.exit(1);
    }
  }

  /** Vérifie les index */
  async ensureIndexes() {
    try {
      await User.syncIndexes();
      console.log("✅ Index MongoDB vérifiés");
    } catch (error) {
      console.error("❌ Erreur lors de la création des index:", error);
    }
  }

  /**
   * Récupère ou crée un utilisateur
   * @param {Object} userData - { id, guildId, username, discriminator, avatar, bot }
   */
  async getUser(userData) {
    if (!userData?.id || !userData?.guildId) {
      throw new Error("ID utilisateur et ID serveur requis");
    }

    const now = new Date();
    let user = await User.findOne({
      userId: userData.id,
      guildId: userData.guildId,
    });

    if (!user) {
      user = new User({
        userId: userData.id,
        guildId: userData.guildId,
        username: userData.username || "Inconnu",
        discriminator: userData.discriminator || "0000",
        avatar: userData.avatar || null,
        bot: Boolean(userData.bot),
        joinedAt: now,
        lastSeen: now,
        stats: {
          level: 1,
          xp: 0,
          messages: 0,
          voiceTime: 0,
          lastMessage: null,
          lastVoiceJoin: null,
          lastActivity: now,
        },
      });
      await user.save();
      console.log(`✅ Utilisateur créé: ${user.username} (${user.userId})`);
      return user;
    }

    // Mettre à jour si nécessaire
    let updated = false;
    ["username", "discriminator", "avatar", "bot"].forEach((field) => {
      if (userData[field] !== undefined && user[field] !== userData[field]) {
        user[field] = userData[field];
        updated = true;
      }
    });

    user.lastSeen = now;
    user.stats.lastActivity = now;

    if (!user.stats) {
      user.stats = {
        level: 1,
        xp: 0,
        messages: 0,
        voiceTime: 0,
        lastMessage: null,
        lastVoiceJoin: null,
        lastActivity: now,
      };
      updated = true;
    }

    if (updated) await user.save();
    return user;
  }

  /**
   * Met à jour un utilisateur
   * @param {string} userId
   * @param {string} guildId
   * @param {Object} updates - Champs à mettre à jour
   * @param {boolean} [incrementMessages=false] - Incrémente le compteur de messages
   */
  async updateUser(userId, guildId, updates = {}, incrementMessages = false) {
    const now = new Date();
    const dbUpdate = { $set: { ...updates, lastSeen: now }, $inc: {} };

    if (incrementMessages) {
      dbUpdate.$inc["stats.messages"] = 1;
      dbUpdate.$set["stats.lastMessage"] = now;
      dbUpdate.$set["stats.lastActivity"] = now;
    }

    const updatedUser = await User.findOneAndUpdate(
      { userId, guildId },
      dbUpdate,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (!updatedUser)
      throw new Error("Utilisateur non trouvé pour la mise à jour");
    return updatedUser;
  }

  /** Récupère tous les membres d'un serveur */
  async getGuildMembers(guildId) {
    return await User.find({ guildId });
  }

  /** Synchronise tous les membres Discord avec la base */
  async syncGuildMembers(guild) {
    console.log(
      `🔄 Synchronisation des membres du serveur: ${guild.name} (${guild.id})`
    );
    const members = await guild.members.fetch();
    const memberArray = Array.from(members.values());
    let syncedCount = 0;

    const batchSize = 100;
    for (let i = 0; i < memberArray.length; i += batchSize) {
      const batch = memberArray.slice(i, i + batchSize);
      const operations = batch.map((member) => ({
        updateOne: {
          filter: { userId: member.id, guildId: guild.id },
          update: {
            $set: {
              username: member.user.username,
              discriminator: member.user.discriminator,
              avatar: member.user.avatar,
              bot: member.user.bot,
              lastSeen: new Date(),
            },
            $setOnInsert: {
              joinedAt: member.joinedAt || new Date(),
              stats: {
                level: 1,
                xp: 0,
                messages: 0,
                voiceTime: 0,
                lastMessage: null,
                lastVoiceJoin: null,
                lastActivity: new Date(),
              },
            },
          },
          upsert: true,
        },
      }));
      if (operations.length > 0) {
        await User.bulkWrite(operations, { ordered: false });
        syncedCount += operations.length;
        console.log(`🔄 Lot traité: ${syncedCount}/${memberArray.length}`);
      }
    }

    console.log(`✅ Synchronisation terminée pour: ${guild.name}`);
    return { total: memberArray.length, synced: syncedCount };
  }

  /** Ferme la connexion MongoDB */
  async close() {
    if (this.isConnected) {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log("🔌 Déconnecté de MongoDB");
    }
  }
}

module.exports = new Database();
