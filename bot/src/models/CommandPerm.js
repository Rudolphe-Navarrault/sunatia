const mongoose = require('mongoose');

const CommandPermSchema = new mongoose.Schema({
  guildId: { type: String, required: true }, // Pour le serveur
  command: { type: String, required: true },
  permissions: { type: [String], default: [] },
});

CommandPermSchema.index({ guildId: 1, command: 1 }, { unique: true });

module.exports = mongoose.model('CommandPerm', CommandPermSchema);
