const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  guildId: { type: String, required: true }, // Pour le serveur
  name: { type: String, required: true },
  permissions: { type: [String], default: [] },
});

module.exports = mongoose.model('Group', GroupSchema);
