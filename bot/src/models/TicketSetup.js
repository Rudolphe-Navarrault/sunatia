// models/TicketSetup.js
const mongoose = require('mongoose');

const ticketSetupSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true }, // Où le message sera envoyé
  messageId: { type: String, required: true }, // ID du message à éditer si besoin
});

module.exports = mongoose.model('TicketSetup', ticketSetupSchema);
