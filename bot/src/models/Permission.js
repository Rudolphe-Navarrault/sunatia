const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
  guildId: { type: String, required: true }, // Pour le serveur
  name: { type: String, required: true },
});

module.exports = mongoose.model('Permission', PermissionSchema);
