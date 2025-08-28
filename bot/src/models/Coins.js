const mongoose = require('mongoose');

const coinsSchema = new mongoose.Schema(
  {
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
    balance: { 
      type: Number, 
      default: 0,
      min: 0
    },
    lastDaily: { 
      type: Date, 
      default: null 
    },
    totalEarned: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Index composé pour des requêtes plus rapides
coinsSchema.index({ userId: 1, guildId: 1 }, { unique: true });
coinsSchema.index({ guildId: 1, balance: -1 });

// Trouver ou créer un document Coins
coinsSchema.statics.findOrCreate = async function (query, defaults = {}) {
  const { userId, guildId } = query;
  if (!userId || !guildId) throw new Error('userId et guildId sont requis');

  let coins = await this.findOne({ userId, guildId });
  if (!coins) {
    coins = new this({
      userId,
      guildId,
      ...defaults
    });
    await coins.save();
  }
  return coins;
};

// Ajouter ou retirer des pièces
coinsSchema.methods.addCoins = async function(amount) {
  if (amount < 0 && this.balance < Math.abs(amount)) {
    throw new Error('Solde insuffisant');
  }
  
  this.balance += amount;
  if (amount > 0) {
    this.totalEarned += amount;
  }
  this.lastUpdated = new Date();
  return this.save();
};

// Vérifier le solde
coinsSchema.methods.getBalance = function() {
  return this.balance;
};

// Mettre à jour la dernière récompense quotidienne
coinsSchema.methods.updateLastDaily = function() {
  this.lastDaily = new Date();
  return this.save();
};

module.exports = mongoose.model('Coins', coinsSchema);
