const mongoose = require('mongoose');

const InfractionSchema = new mongoose.Schema({
  userId: String,
  guildId: String,
  type: String,
  count: { type: Number, default: 1 },
  lastDate: { type: Date, default: Date.now },
  reasons: { type: [String], default: [] },
});

module.exports = mongoose.model('Infraction', InfractionSchema);
