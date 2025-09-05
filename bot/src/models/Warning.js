const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    index: true
  },
  guildId: { 
    type: String, 
    required: true,
    index: true 
  },
  moderatorId: { 
    type: String, 
    required: true 
  },
  reason: { 
    type: String, 
    required: true 
  },
  points: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  active: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null // Si null, l'avertissement n'expire pas
  }
}, { timestamps: true });

// Index pour les requêtes fréquentes
warningSchema.index({ userId: 1, guildId: 1, active: 1 });
warningSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Méthode pour désactiver un avertissement
warningSchema.methods.deactivate = async function() {
  this.active = false;
  await this.save();
  return this;
};

// Méthode statique pour obtenir le nombre total de points d'avertissement actifs d'un membre
warningSchema.statics.getTotalPoints = async function(userId, guildId) {
  const result = await this.aggregate([
    {
      $match: {
        userId,
        guildId,
        active: true,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } }
        ]
      }
    },
    {
      $group: {
        _id: null,
        totalPoints: { $sum: '$points' }
      }
    }
  ]);

  return result.length > 0 ? result[0].totalPoints : 0;
};

// Méthode statique pour obtenir tous les avertissements actifs d'un membre
warningSchema.statics.getActiveWarnings = function(userId, guildId) {
  return this.find({
    userId,
    guildId,
    active: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ createdAt: -1 });
};

// Méthode statique pour désactiver tous les avertissements d'un membre
warningSchema.statics.deactivateAll = function(userId, guildId, moderatorId) {
  return this.updateMany(
    { userId, guildId, active: true },
    { 
      $set: { 
        active: false,
        'metadata.clearedBy': moderatorId,
        'metadata.clearedAt': new Date()
      } 
    }
  );
};

const Warning = mongoose.model('Warning', warningSchema);

module.exports = Warning;
