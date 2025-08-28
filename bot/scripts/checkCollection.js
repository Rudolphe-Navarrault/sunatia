const mongoose = require('mongoose');
require('dotenv').config();

async function checkCollection() {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    const mongoUri = isDev ? process.env.MONGO_URI_DEV : process.env.MONGO_URI;
    
    console.log(`🔗 Connexion à la base de données: ${mongoUri.split('@')[1]}`);
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    const db = mongoose.connection.db;
    console.log(`✅ Connecté à la base de données: ${db.databaseName}`);
    
    // Vérifier la collection currencies
    const collections = await db.listCollections({ name: 'currencies' }).toArray();
    if (collections.length === 0) {
      console.log('❌ La collection "currencies" n\'existe pas');
      return;
    }
    
    console.log('✅ Collection "currencies" trouvée');
    
    // Compter les documents
    const Currency = require('../src/models/Currency');
    const count = await Currency.countDocuments({});
    console.log(`📊 Nombre de documents: ${count}`);
    
    if (count > 0) {
      // Afficher les premiers documents
      const docs = await Currency.find({}).limit(3).lean();
      console.log('\n📝 Exemple de documents:');
      console.log(JSON.stringify(docs, null, 2));
      
      // Vérifier avec le guildId spécifique
      const guildId = '1409334824329805898'; // Votre DEV_GUILD_ID
      const guildDocs = await Currency.find({ guildId }).limit(3).lean();
      console.log(`\n🔍 Documents avec guildId=${guildId}: ${guildDocs.length}`);
      console.log(JSON.stringify(guildDocs, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkCollection();
