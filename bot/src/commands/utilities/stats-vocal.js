const { ChannelType, PermissionFlagsBits, Client } = require('discord.js');
const mongoose = require('mongoose');
const { GuildSettings } = require('../../models/GuildSettings');

// Référence au client Discord
let client;

// Fonction pour définir le client
const setClient = (discordClient) => {
  client = discordClient;
};

exports.setClient = setClient;

// Stockage en mémoire pour les salons de statistiques
const statsChannels = new Map();

// Mettre à jour le compteur de membres
async function updateMemberCount(guild) {
  try {
    console.log(`🔍 Tentative de mise à jour du compteur pour le serveur: ${guild.name} (${guild.id})`);
    
    // Vérifier d'abord dans le cache
    let channelId = statsChannels.get(guild.id);
    
    // Si pas dans le cache, vérifier dans GuildSettings
    if (!channelId) {
      console.log('ℹ️ Salon non trouvé dans le cache, vérification dans GuildSettings...');
      const guildSettings = await GuildSettings.findOne({ guildId: guild.id });
      if (guildSettings?.statsChannelId) {
        channelId = guildSettings.statsChannelId;
        statsChannels.set(guild.id, channelId); // Mettre en cache
      } else {
        console.log(`❌ Aucun salon de statistiques trouvé pour le serveur: ${guild.name}`);
        return;
      }
    }
    
    console.log(`✅ Salon de statistiques trouvé: ${channelId}`);

    // Récupérer le salon
    let channel = guild.channels.cache.get(channelId);
    
    // Si le salon n'est pas dans le cache, essayer de le récupérer
    if (!channel) {
      try {
        console.log(`ℹ️ Salon ${channelId} non trouvé dans le cache, tentative de récupération...`);
        channel = await guild.channels.fetch(channelId);
      } catch (fetchError) {
        console.error('❌ Erreur lors de la récupération du salon:', fetchError);
      }
    }
    
    // Si le salon n'existe toujours pas, nettoyer
    if (!channel) {
      console.log(`❌ Le salon ${channelId} n'existe plus, nettoyage...`);
      statsChannels.delete(guild.id);
      await GuildSettings.updateOne(
        { guildId: guild.id },
        { $set: { statsChannelId: null } }
      );
      return;
    }

    // Compter les membres non-bots
    let memberCount;
    try {
      // Forcer un rafraîchissement du cache des membres si nécessaire
      if (guild.members.cache.size < guild.memberCount) {
        console.log('🔄 Rafraîchissement du cache des membres...');
        await guild.members.fetch();
      }
      
      // Compter les membres non-bots
      memberCount = guild.members.cache.filter(member => !member.user.bot).size;
      console.log(`👥 Membres non-bots: ${memberCount}/${guild.memberCount}`);
      
    } catch (err) {
      console.error('⚠️ Erreur lors du comptage des membres:', err);
      memberCount = guild.memberCount; // Utiliser le compte total en cas d'erreur
    }

    // Mettre à jour le nom du salon si nécessaire
    const newName = `👥 Membres: ${memberCount}`;
    if (channel.name !== newName) {
      console.log(`🔄 Mise à jour du nom: "${channel.name}" → "${newName}"`);
      try {
        await channel.setName(newName, 'Mise à jour du nombre de membres');
        console.log('✅ Nom du salon mis à jour avec succès!');
      } catch (err) {
        console.error('❌ Erreur lors de la mise à jour du nom:', err);
        if (err.code === 50013) {
          console.log('⚠️ Permission refusée pour modifier le salon. Vérifiez les permissions du bot.');
        } else if (err.code === 30034) {
          console.log('⚠️ Trop de requêtes. Réessayez plus tard.');
        }
      }
    } else {
      console.log('ℹ️ Le nom du salon est déjà à jour');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du compteur de membres:', error);
  }
}

// Exports
exports.statsChannels = statsChannels;
exports.updateMemberCount = updateMemberCount;

// Charger les salons depuis GuildSettings
exports.initializeStatsChannels = async function() {
  try {
    // Charger depuis GuildSettings
    const guildsWithStats = await GuildSettings.find({ statsChannelId: { $ne: null } });
    
    // Mettre à jour le cache en mémoire
    guildsWithStats.forEach(guild => {
      if (guild.statsChannelId) {
        statsChannels.set(guild.guildId, guild.statsChannelId);
      }
    });
    
    console.log(`✅ ${guildsWithStats.length} salon(s) de statistiques chargé(s) depuis GuildSettings`);
    
    // Vérifier que les salons existent bien
    for (const [guildId, channelId] of statsChannels.entries()) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          const channel = guild.channels.cache.get(channelId);
          if (!channel) {
            console.log(`⚠️ Le salon ${channelId} n'existe plus sur le serveur ${guild.name}, suppression du cache...`);
            // Mettre à jour GuildSettings pour refléter que le salon n'existe plus
            await GuildSettings.updateOne(
              { guildId },
              { $set: { statsChannelId: null } }
            );
            statsChannels.delete(guildId);
          }
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la vérification du salon ${channelId} du serveur ${guildId}:`, error);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du chargement des salons de statistiques:', error);
  }
};

// Créer un nouveau salon de statistiques
exports.createStatsChannel = async function(guild, channelName = `👥 Membres: ${guild.memberCount}`) {
  try {
    console.log(`🔍 Vérification d'un salon existant pour le serveur: ${guild.name} (${guild.id})`);
    
    // Vérifier si un salon existe déjà dans le cache
    const existingChannelId = statsChannels.get(guild.id);
    if (existingChannelId) {
      const existingChannel = guild.channels.cache.get(existingChannelId);
      if (existingChannel) {
        console.log(`ℹ️ Salon existant trouvé dans le cache: ${existingChannel.name} (${existingChannel.id})`);
        return { 
          success: false, 
          message: `Un salon de statistiques existe déjà : ${existingChannel}` 
        };
      } else {
        // Nettoyer le cache si le salon n'existe plus
        statsChannels.delete(guild.id);
      }
    }

    // Vérifier dans GuildSettings
    const guildSettings = await GuildSettings.findOne({ guildId: guild.id });
    if (guildSettings?.statsChannelId) {
      const channel = guild.channels.cache.get(guildSettings.statsChannelId);
      if (channel) {
        console.log(`ℹ️ Salon existant trouvé dans GuildSettings: ${channel.name} (${channel.id})`);
        statsChannels.set(guild.id, channel.id);
        return { 
          success: false, 
          message: `Un salon de statistiques existe déjà : ${channel}` 
        };
      } else {
        // Mettre à jour GuildSettings si le salon n'existe plus
        await GuildSettings.updateOne(
          { guildId: guild.id },
          { $set: { statsChannelId: null } }
        );
      }
    }

    // Vérifier les permissions
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      console.log('❌ Permission refusée: Gérer les salons');
      return { 
        success: false, 
        message: 'Je n\'ai pas la permission de gérer les salons sur ce serveur.' 
      };
    }

    // Créer le salon vocal
    console.log(`🔄 Création du salon de statistiques pour ${guild.name}...`);
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.Connect],
        },
      ],
      reason: 'Création du salon de statistiques des membres',
    });

    // Mettre à jour GuildSettings
    await GuildSettings.findOneAndUpdate(
      { guildId: guild.id },
      { $set: { statsChannelId: channel.id } },
      { upsert: true, new: true }
    );

    // Mettre à jour le cache
    statsChannels.set(guild.id, channel.id);
    console.log(`🔄 Cache mis à jour pour le serveur: ${guild.id}`);

    return { 
      success: true, 
      message: `✅ Salon de statistiques créé : ${channel}`,
      channel 
    };
  } catch (error) {
    console.error('❌ Erreur lors de la création du salon de statistiques:', error);
    return { 
      success: false, 
      message: 'Une erreur est survenue lors de la création du salon de statistiques.'
    };
  }
};

// Supprimer le salon de statistiques
exports.deleteStatsChannel = async function(guild) {
  try {
    console.log(`🔍 Tentative de suppression du salon de statistiques pour le serveur: ${guild.name} (${guild.id})`);
    
    // Vérifier si un salon existe dans le cache
    const channelId = statsChannels.get(guild.id);
    if (!channelId) {
      console.log('ℹ️ Aucun salon de statistiques trouvé dans le cache pour ce serveur');
      
      // Vérifier dans GuildSettings au cas où
      const guildSettings = await GuildSettings.findOne({ guildId: guild.id });
      if (!guildSettings?.statsChannelId) {
        return { 
          success: false, 
          message: 'Aucun salon de statistiques trouvé pour ce serveur.' 
        };
      }
      
      // Mettre à jour le cache avec la valeur de GuildSettings
      statsChannels.set(guild.id, guildSettings.statsChannelId);
    }

    // Supprimer le salon s'il existe
    const channel = guild.channels.cache.get(channelId);
    if (channel) {
      try {
        await channel.delete('Suppression du salon de statistiques');
        console.log(`✅ Salon de statistiques supprimé: ${channel.name} (${channel.id})`);
      } catch (error) {
        console.error('❌ Erreur lors de la suppression du salon:', error);
        if (error.code === 50013) {
          return { 
            success: false, 
            message: 'Je n\'ai pas la permission de supprimer ce salon.' 
          };
        }
        throw error;
      }
    }

    // Mettre à jour GuildSettings
    await GuildSettings.updateOne(
      { guildId: guild.id },
      { $set: { statsChannelId: null } }
    );
    
    // Supprimer du cache
    statsChannels.delete(guild.id);

    return { 
      success: true, 
      message: 'Le salon de statistiques a été supprimé avec succès.' 
    };
  } catch (error) {
    console.error('❌ Erreur lors de la suppression du salon de statistiques:', error);
    return { 
      success: false, 
      message: 'Une erreur est survenue lors de la suppression du salon de statistiques.'
    };
  }
};
