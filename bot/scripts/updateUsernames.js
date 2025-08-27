require('dotenv').config();
const mongoose = require('mongoose');
const { Client, GatewayIntentBits } = require('discord.js');
const User = require('../src/models/User'); // chemin vers ton modèle User

// --- Connexion à MongoDB ---
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ Connecté à MongoDB'))
  .catch(console.error);

// --- Initialisation du client Discord ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // nécessaire pour récupérer tous les membres
  ],
});

// --- Fonction de migration ---
async function migrateExistingMembers() {
  try {
    console.log('🔄 Démarrage de la migration des membres existants...');

    for (const [guildId, guild] of client.guilds.cache) {
      console.log(`📌 Serveur: ${guild.name} (${guildId})`);

      // Récupérer tous les membres
      const members = await guild.members.fetch(); // fetch all members
      console.log(`   🔹 ${members.size} membres trouvés`);

      for (const [memberId, member] of members) {
        // Préparer les données pour le modèle User
        const userData = {
          userId: member.user.id,
          guildId: guildId,
          username: member.user.username,
          discriminator: member.user.discriminator,
          avatar: member.user.avatar,
          bot: member.user.bot,
          stats: {
            level: 1,
            xp: 0,
            messages: 0,
            voiceTime: 0,
            lastMessage: null,
            lastVoiceJoin: null,
            lastActivity: new Date(),
          },
          joinedAt: member.joinedAt || new Date(),
          lastSeen: new Date(),
        };

        // Créer ou mettre à jour l'utilisateur
        await User.findOrCreate({ userId: member.user.id, guildId: guildId }, userData);
      }

      console.log(`   ✅ Tous les membres du serveur ${guild.name} migrés`);
    }

    console.log('🎉 Migration terminée avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
  } finally {
    mongoose.connection.close();
    client.destroy();
    console.log('🔒 Fermeture MongoDB et client Discord');
  }
}

// --- Quand le bot est prêt ---
client.once('ready', async () => {
  console.log(`🚀 Connecté en tant que ${client.user.tag}`);
  await migrateExistingMembers();
});

// --- Login Discord ---
client.login(process.env.DISCORD_TOKEN);
