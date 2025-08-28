const mongoose = require('mongoose');
const config = require('../config');
const User = require('../models/User');
const logger = require('./logger');

class Database {
  constructor() {
    this.mongoose = mongoose;
    this.models = { User };
    this.User = User;
    this.isConnected = false;
    this.connection = null;

    mongoose.connection.on('connected', () => {
      logger.info('✅ Connecté à MongoDB');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      logger.error('❌ Erreur de connexion MongoDB:', err);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('🔌 Déconnecté de MongoDB');
      this.isConnected = false;
    });
  }

  async connect() {
    if (this.isConnected) {
      logger.info('✅ Déjà connecté à MongoDB');
      return this.connection || mongoose.connection;
    }

    try {
      logger.info('🔄 Tentative de connexion à MongoDB...');

      const uri = config.mongo.uri;
      let safeUrl;
      try {
        const dbUrl = new URL(uri);
        safeUrl = `${dbUrl.protocol}//${dbUrl.hostname}${dbUrl.pathname}`;
      } catch {
        safeUrl = uri.replace(/\/\/.*@/, '//***:***@');
      }
      logger.debug(`📡 Connexion à la base de données: ${safeUrl}`);

      const options = { ...config.mongo.options };
      this.connection = await mongoose.connect(uri, options);

      // Ping pour vérifier la connexion
      await this.connection.connection.db.admin().ping();
      logger.info('✅ Connecté à MongoDB avec succès');

      await this.ensureIndexes();

      const collections = await this.connection.connection.db.listCollections().toArray();
      logger.debug(`📚 Collections disponibles: ${collections.map((c) => c.name).join(', ')}`);

      return this.connection;
    } catch (error) {
      logger.error('❌ Erreur de connexion à MongoDB:', error);
      throw error;
    }
  }

  async ensureIndexes() {
    try {
      logger.info('🔍 Vérification des index MongoDB...');
      await User.init();
      logger.debug('✅ Index pour le modèle User vérifiés');
      logger.info('✅ Tous les index MongoDB sont à jour');
    } catch (error) {
      logger.error('❌ Erreur lors de la vérification des index:', error);
      throw error;
    }
  }

  async getUser(userData) {
    if (!userData?.id || !userData?.guildId) throw new Error('ID utilisateur et ID serveur requis');

    const now = new Date();
    let user = await User.findOne({ userId: userData.id, guildId: userData.guildId });

    if (!user) {
      user = new User({
        userId: userData.id,
        guildId: userData.guildId,
        username: userData.username || 'Inconnu',
        discriminator: userData.discriminator || '0000',
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
      logger.info(`✅ Utilisateur créé: ${user.username} (${user.userId})`);
      return user;
    }

    // Mise à jour si nécessaire
    let updated = false;
    ['username', 'discriminator', 'avatar', 'bot'].forEach((field) => {
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

  async updateUser(userId, guildId, updates = {}, incrementMessages = false) {
    const now = new Date();
    const dbUpdate = { $set: { ...updates, lastSeen: now }, $inc: {} };

    if (incrementMessages) {
      dbUpdate.$inc['stats.messages'] = 1;
      dbUpdate.$set['stats.lastMessage'] = now;
      dbUpdate.$set['stats.lastActivity'] = now;
    }

    const updatedUser = await User.findOneAndUpdate({ userId, guildId }, dbUpdate, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

    if (!updatedUser) throw new Error('Utilisateur non trouvé pour la mise à jour');
    return updatedUser;
  }

  async getGuildMembers(guildId) {
    return await User.find({ guildId });
  }

  async syncGuildMembers(guild) {
    logger.info(`🔄 Synchronisation des membres du serveur: ${guild.name} (${guild.id})`);
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
        logger.debug(`🔄 Lot traité: ${syncedCount}/${memberArray.length}`);
      }
    }

    logger.info(`✅ Synchronisation terminée pour: ${guild.name}`);
    return { total: memberArray.length, synced: syncedCount };
  }

  async close() {
    if (this.isConnected) {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('🔌 Déconnecté de MongoDB');
    }
  }
}

module.exports = new Database();
