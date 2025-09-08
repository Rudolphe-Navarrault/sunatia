// models/Permission.js
const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, lowercase: true },
});

module.exports = mongoose.model('Permission', permissionSchema);
