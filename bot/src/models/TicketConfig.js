const { Schema, model } = require('mongoose');

const ticketConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true },
    categoryId: { type: String, required: true },
    staffRoleId: { type: String, required: true },
    setupChannelId: { type: String, required: true },
    setupMessageId: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = model('TicketConfig', ticketConfigSchema);
