const mongoose = require('mongoose');

const currencySchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  guildId: { 
    type: String, 
    required: true 
  },
  balance: { 
    type: Number, 
    default: 0,
    min: 0
  },
  lastDaily: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Index composé pour les recherches fréquentes
currencySchema.index({ guildId: 1, userId: 1 }, { unique: true });

// Méthode statique pour obtenir ou créer un utilisateur
currencySchema.statics.getUser = async function(userId, guildId) {
  let user = await this.findOne({ userId, guildId });
  if (!user) {
    user = await this.create({ userId, guildId });
  }
  return user;
};

// Méthode pour ajouter de l'argent
currencySchema.methods.addMoney = async function(amount) {
  if (amount < 0) throw new Error('Le montant doit être positif');
  this.balance += amount;
  return this.save();
};

// Méthode pour retirer de l'argent
currencySchema.methods.removeMoney = async function(amount) {
  if (amount < 0) throw new Error('Le montant doit être positif');
  if (this.balance < amount) throw new Error('Fonds insuffisants');
  this.balance -= amount;
  return this.save();
};

// Méthode pour transférer de l'argent
currencySchema.methods.transferMoney = async function(targetUser, amount) {
  await this.removeMoney(amount);
  await targetUser.addMoney(amount);
  return { from: this, to: targetUser };
};

// Méthode pour réinitialiser le daily
currencySchema.methods.setDaily = async function() {
  this.lastDaily = new Date();
  return this.save();
};

module.exports = mongoose.model('Currency', currencySchema);
