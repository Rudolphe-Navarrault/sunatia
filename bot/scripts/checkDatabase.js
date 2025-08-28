const mongoose = require('mongoose');
require('dotenv').config();

const isDev = process.env.NODE_ENV === 'development';
const mongoUri = isDev ? process.env.MONGO_URI_DEV : process.env.MONGO_URI;

async function checkDatabase() {
  try {
    console.log('🔍 Vérification de la base de données...');
    
    // Connexion à MongoDB
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });
    
    const db = mongoose.connection.db;
    console.log(`✅ Connecté à la base de données: ${db.databaseName}`);
    
    // Lister toutes les collections
    const collections = await db.listCollections().toArray();
    console.log('\n📚 Collections disponibles:');
    console.log(collections.map(c => `- ${c.name}`).join('\n'));
    
    // Vérifier si la collection currencies existe
    const hasCurrencies = collections.some(c => c.name === 'currencies');
    console.log(`\n🔍 Collection 'currencies' trouvée: ${hasCurrencies ? '✅' : '❌'}`);
    
    if (hasCurrencies) {
      const Currency = require('../src/models/Currency');
      const count = await Currency.countDocuments({});
      console.log(`📊 Nombre de documents dans 'currencies': ${count}`);
      
      // Afficher quelques documents
      if (count > 0) {
        const sample = await Currency.find({}).limit(2).lean();
        console.log('\n📝 Exemple de documents:');
        console.log(JSON.stringify(sample, null, 2));
      }
    }
    
    // Vérifier les bases de données
    const adminDb = mongoose.connection.getClient().db('admin');
    const dbs = await adminDb.admin().listDatabases();
    console.log('\n🏢 Bases de données disponibles:');
    console.log(dbs.databases.map(db => `- ${db.name}`).join('\n'));
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de la base de données:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkDatabase();
