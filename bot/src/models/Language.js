const mongoose = require('mongoose');

const languageSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, default: null }, // null = serveur
    lang: { type: String, required: true },
  },
  { timestamps: true }
);

languageSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Language', languageSchema);
