const { Schema, model } = require('mongoose');

const guildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  memberCountChannelId: { type: String, default: null },
});

module.exports = model('GuildConfig', guildConfigSchema);
