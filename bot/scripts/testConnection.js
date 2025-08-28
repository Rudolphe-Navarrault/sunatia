const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  try {
    const isDev = process.env.NODE_ENV === 'development';
    const mongoUri = isDev ? process.env.MONGO_URI_DEV : process.env.MONGO_URI;
    
    console.log('🔍 Test de connexion à la base de données...');
    console.log(`🔗 URI: ${mongoUri.split('@')[1]}`);
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    console.log('✅ Connecté à MongoDB avec succès');
    
    // Charger le modèle Currency
    const Currency = require('../src/models/Currency');
    
    // Vérifier la collection
    const collections = await mongoose.connection.db.listCollections({ name: 'currencies' }).toArray();
    console.log('📚 Collection currencies trouvée:', collections.length > 0);
    
    if (collections.length > 0) {
      // Compter les documents
      const count = await Currency.countDocuments({});
      console.log(`📊 Nombre de documents dans currencies: ${count}`);
      
      // Afficher un document exemple
      const doc = await Currency.findOne({}).lean();
      if (doc) {
        console.log('📝 Document exemple:');
        console.log(JSON.stringify(doc, null, 2));
        
        // Vérifier le guildId
        console.log(`🔍 Vérification du guildId (${doc.guildId}):`, typeof doc.guildId);
        
        // Rechercher avec le même guildId
        const query = { guildId: doc.guildId };
        const found = await Currency.findOne(query);
        console.log('🔍 Document trouvé avec le même guildId:', found !== null);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

testConnection();
