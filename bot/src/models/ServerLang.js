const mongoose = require('mongoose');

const serverLangSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  langs: { type: [String], default: ['en', 'fr'] },
  default: { type: String, default: 'en' },
});

module.exports = mongoose.model('ServerLang', serverLangSchema);
