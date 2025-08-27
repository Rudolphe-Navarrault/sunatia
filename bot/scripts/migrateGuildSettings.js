// scripts/migrateGuildSettings.js
require('dotenv').config();
const mongoose = require('mongoose');
const { GuildSettings } = require('../src/models/GuildSettings'); // adapte le chemin si besoin

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connecté à MongoDB');

    const result = await GuildSettings.updateMany(
      { welcomeChannelId: { $exists: false } },
      { $set: { welcomeChannelId: null } }
    );

    console.log(`✅ Migration terminée. ${result.modifiedCount} documents mis à jour.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error);
    process.exit(1);
  }
})();
