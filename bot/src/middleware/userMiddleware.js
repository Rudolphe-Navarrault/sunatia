const User = require('../models/User');

/**
 * Middleware pour s'assurer que l'utilisateur existe dans la base de données
 * @param {import('discord.js').Interaction} interaction - L'interaction Discord
 * @param {import('discord.js').Client} client - Le client Discord
 */
async function ensureUser(interaction, client) {
  if (!interaction.inGuild() || interaction.user.bot) return;

  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ 
      userId: interaction.user.id, 
      guildId: interaction.guildId 
    });

    // Si l'utilisateur n'existe pas ou si son nom a changé, on met à jour
    if (!existingUser || existingUser.username !== interaction.user.username) {
      await User.findOneAndUpdate(
        { 
          userId: interaction.user.id, 
          guildId: interaction.guildId 
        },
        {
          $set: {
            username: interaction.user.username,
            discriminator: interaction.user.discriminator,
            bot: interaction.user.bot,
            lastSeen: new Date()
          },
          $setOnInsert: {
            joinedAt: new Date(),
            stats: { 
              level: 1, 
              xp: 0, 
              messages: 0, 
              voiceTime: 0, 
              lastMessage: null, 
              lastVoiceJoin: null 
            }
          }
        },
        { 
          upsert: true,
          new: true,
          setDefaultsOnInsert: true 
        }
      );
    }
  } catch (error) {
    console.error('Erreur lors de la vérification/création du profil utilisateur:', error);
  }
}

module.exports = { ensureUser };
