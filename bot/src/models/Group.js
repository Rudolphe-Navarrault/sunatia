const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    guildId: { type: String, required: true },
    permissions: { type: [String], default: [] },
  },
  { timestamps: true }
);

groupSchema.index({ name: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.model('Group', groupSchema);
