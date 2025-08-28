const mongoose = require('mongoose');

const currencySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastDaily: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index composé unique pour garantir l'unicité de la paire (guildId, userId)
// ⚠️ On lui donne un nom spécifique pour éviter conflit avec User.js
currencySchema.index(
  { guildId: 1, userId: 1 },
  { unique: true, name: 'currency_guild_user_unique' }
);

// Méthode statique pour obtenir un utilisateur
currencySchema.statics.getUser = async function (userId, guildId) {
  return await this.findOne({ userId, guildId });
};

// Méthode pour créer un nouvel utilisateur
currencySchema.statics.createUser = async function (userId, guildId) {
  try {
    const user = new this({ userId, guildId, balance: 0, lastDaily: null });
    return await user.save({ validateBeforeSave: false });
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur:", error);
    if (error.code === 11000) {
      return await this.findOne({ userId, guildId });
    }
    throw error;
  }
};

// Méthode pour ajouter de l'argent
currencySchema.methods.addMoney = async function (amount) {
  if (amount < 0) throw new Error('Le montant doit être positif');
  this.balance += amount;
  return this.save({ validateBeforeSave: false });
};

// Méthode pour retirer de l'argent
currencySchema.methods.removeMoney = async function (amount) {
  if (amount < 0) throw new Error('Le montant doit être positif');
  if (this.balance < amount) throw new Error('Fonds insuffisants');
  this.balance -= amount;
  return this.save({ validateBeforeSave: false });
};

// Méthode pour transférer de l'argent
currencySchema.methods.transferMoney = async function (targetUser, amount) {
  await this.removeMoney(amount);
  await targetUser.addMoney(amount);
  return { from: this, to: targetUser };
};

// Méthode pour réinitialiser le daily
currencySchema.methods.setDaily = async function () {
  this.lastDaily = new Date();
  return this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('Currency', currencySchema);
