const mongoose = require('mongoose');

// Schéma pour les statistiques d'un utilisateur
const userStatsSchema = new mongoose.Schema(
  {
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    messages: { type: Number, default: 0 },
    voiceTime: { type: Number, default: 0 }, // en secondes
    lastMessage: { type: Date, default: null },
    lastVoiceJoin: { type: Date, default: null },
    lastActivity: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Schéma principal de l'utilisateur
const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    discriminator: { type: String, default: '0' },
    avatar: { type: String, default: null },
    bot: { type: Boolean, default: false },
    bio: { type: String, default: '' },
    birthdate: { type: Date, default: null },
    stats: { type: userStatsSchema, default: () => ({}) },
    joinedAt: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: new Map() },
  },
  { timestamps: true }
);

// Index composé
userSchema.index({ userId: 1, guildId: 1 }, { unique: true, name: 'user_guild_unique' });
userSchema.index({ guildId: 1, 'stats.level': -1 });
userSchema.index({ guildId: 1, 'stats.xp': -1 });

// Récupérer ou créer un utilisateur
userSchema.statics.findOrCreate = async function (query, defaults = {}) {
  const { userId, guildId } = query;
  if (!userId || !guildId) throw new Error('userId et guildId sont requis');

  let user = await this.findOne({ userId, guildId });
  if (!user) {
    user = new this({
      userId,
      guildId,
      username: query.username || defaults.username || 'Unknown',
      discriminator: query.discriminator || defaults.discriminator || '0000',
      bot: query.bot || defaults.bot || false,
      joinedAt: new Date(),
      lastSeen: new Date(),
      stats: { level: 1, xp: 0, messages: 0, voiceTime: 0, lastMessage: null, lastVoiceJoin: null },
      ...defaults,
    });
    await user.save();
  }
  return user;
};

// Ajouter de l'XP
userSchema.methods.addXP = async function (amount) {
  try {
    const xpToAdd = parseInt(amount, 10);
    if (isNaN(xpToAdd) || xpToAdd <= 0) throw new Error("Montant d'XP invalide");

    let { level = 1, xp = 0 } = this.stats || {};
    let newXp = xp + xpToAdd;
    let newLevel = level;

    let xpForNextLevel = newLevel * 1000;
    while (newXp >= xpForNextLevel) {
      newXp -= xpForNextLevel;
      newLevel += 1;
      xpForNextLevel = newLevel * 1000;
    }

    const updatedUser = await this.constructor.findOneAndUpdate(
      { userId: this.userId, guildId: this.guildId },
      {
        $set: {
          'stats.level': newLevel,
          'stats.xp': newXp,
          lastSeen: new Date(),
          'stats.lastActivity': new Date(),
        },
        $inc: { 'stats.messages': 1 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    this.stats = updatedUser.stats;
    this.markModified('stats');
    return this;
  } catch (error) {
    console.error("Erreur lors de l'ajout d'XP:", error);
    throw error;
  }
};

// Mettre à jour la dernière activité
userSchema.statics.updateLastActivity = async function (userId, guildId) {
  try {
    const UserModel = this; // <-- s'assurer que c'est bien le modèle
    await UserModel.findOneAndUpdate(
      { userId, guildId },
      { $set: { 'stats.lastActivity': new Date(), lastSeen: new Date() } },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la dernière activité:', error);
  }
};

// Méthode pour définir la localité d'un utilisateur
userSchema.methods.setLocation = function(location) {
  this.metadata.set('location', location);
  return this.save();
};

// Méthode pour obtenir la localité d'un utilisateur
userSchema.methods.getLocation = function() {
  return this.metadata.get('location') || 'Non précisée';
};

// Middleware pour la sauvegarde
userSchema.pre('save', function (next) {
  if (!this.joinedAt) this.joinedAt = new Date();
  this.lastSeen = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);
