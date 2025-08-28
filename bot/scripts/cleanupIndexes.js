require('dotenv').config();
const mongoose = require('mongoose');

const uris = {
  prod: process.env.MONGO_URI,
  dev: process.env.MONGO_URI_DEV,
};

async function cleanupIndexes(uri, dbName) {
  console.log(`🔍 Connexion à la base ${dbName}...`);
  const conn = await mongoose.createConnection(uri, {
    dbName,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const currencies = conn.collection('currencies');

  console.log(`📂 Index avant nettoyage dans ${dbName}:`);
  let indexes = await currencies.indexes();
  console.log(indexes);

  // Supprimer l’index fautif "userId_1" s’il existe
  if (indexes.some((idx) => idx.name === 'userId_1')) {
    console.log(`🗑️ Suppression de l'index userId_1 dans ${dbName}...`);
    await currencies.dropIndex('userId_1');
  } else {
    console.log(`✅ Aucun index userId_1 trouvé dans ${dbName}`);
  }

  // Vérifier les index restants
  indexes = await currencies.indexes();
  console.log(`📂 Index après nettoyage dans ${dbName}:`);
  console.log(indexes);

  await conn.close();
  console.log(`✔️ Nettoyage terminé pour ${dbName}\n`);
}

async function run() {
  try {
    await cleanupIndexes(uris.prod, 'sunatia');
    await cleanupIndexes(uris.dev, 'sunatia-dev');
    console.log('🎉 Tous les nettoyages sont terminés !');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors du nettoyage:', err);
    process.exit(1);
  }
}

run();
