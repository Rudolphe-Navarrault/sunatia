const mongoose = require('mongoose');

const guildSettingsSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    xpEnabled: { type: Boolean, default: true },

    leveling: {
      channelId: { type: String, default: null },
      levelUpMessage: { type: String, default: '{user} a atteint le niveau {level} !' },
      xpPerMessage: {
        min: { type: Number, default: 5 },
        max: { type: Number, default: 10 },
      },
      cooldown: { type: Number, default: 60 },
      blacklistedChannels: { type: [String], default: [] },
      blacklistedRoles: { type: [String], default: [] },
    },

    welcomeChannelId: { type: String, default: null },
  },
  { timestamps: true }
);

const GuildSettings = mongoose.model('GuildSettings', guildSettingsSchema);

module.exports = { GuildSettings };
