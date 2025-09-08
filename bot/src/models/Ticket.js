const { Schema, model } = require('mongoose');

const ticketSchema = new Schema(
  {
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    reason: { type: String, default: 'Aucune raison fournie' },
    status: { type: String, enum: ['open', 'paused', 'closed'], default: 'open' },
  },
  { timestamps: true }
);

module.exports = model('Ticket', ticketSchema);
