const mongoose = require('mongoose');

const commandPermSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  command: { type: String, required: true },
  permissions: { type: [String], default: [] }, // permissions nécessaires pour cette commande
});

commandPermSchema.index({ guildId: 1, command: 1 }, { unique: true });

module.exports = mongoose.model('CommandPerm', commandPermSchema);
