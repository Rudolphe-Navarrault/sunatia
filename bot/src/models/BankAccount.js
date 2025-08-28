const mongoose = require('mongoose');
const crypto = require('crypto');

const bankAccountSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['courant', 'epargne', 'investissement'],
      default: 'courant',
    },
    balance: { type: Number, default: 0 },
    totalDeposited: { type: Number, default: 0 },
    lastInterest: { type: Date, default: null },
    lastFee: { type: Date, default: null },
    iban: { type: String, unique: true },
  },
  { timestamps: true }
);

// Générer un IBAN unique FR + 16 caractères alphanumériques
bankAccountSchema.pre('save', async function (next) {
  if (!this.iban) {
    let unique = false;

    while (!unique) {
      const random = crypto.randomBytes(8).toString('hex').toUpperCase();
      const iban = `FR${random}`;
      const existing = await mongoose.model('BankAccount').findOne({ iban });
      if (!existing) {
        this.iban = iban;
        unique = true;
      }
    }
  }
  next();
});

module.exports = mongoose.model('BankAccount', bankAccountSchema);
