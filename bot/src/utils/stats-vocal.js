const { ChannelType, PermissionFlagsBits, Client } = require('discord.js');
const mongoose = require('mongoose');
const { GuildSettings } = require('../models/GuildSettings');

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
  const logger = console;
  logger.log('\n' + '='.repeat(80));
  logger.log(`[${new Date().toISOString()}] 🔄 DÉBUT updateMemberCount`);
  logger.log(`🏠 Serveur: ${guild.name} (${guild.id})`);
  
  try {
    // 1. Vérifier si le bot a les permissions nécessaires
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      logger.error('❌ Le bot n\'a pas la permission de gérer les salons');
      return;
    }

    // 2. Récupérer l'ID du salon depuis le cache ou la base de données
    let channelId = statsChannels.get(guild.id);
    if (!channelId) {
      logger.log('ℹ️ Salon non trouvé dans le cache, vérification dans la base de données...');
      const guildSettings = await GuildSettings.findOne({ guildId: guild.id });
      if (guildSettings?.statsChannelId) {
        channelId = guildSettings.statsChannelId;
        statsChannels.set(guild.id, channelId);
        logger.log(`✅ Salon chargé depuis la base de données: ${channelId}`);
      } else {
        logger.log('ℹ️ Aucun salon de statistiques configuré pour ce serveur');
        return;
      }
    }

    // 3. Récupérer le salon
    let channel;
    try {
      channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId);
      if (!channel) throw new Error('Salon non trouvé');
      logger.log(`✅ Salon trouvé: #${channel.name} (${channel.id})`);
    } catch (error) {
      logger.error(`❌ Erreur lors de la récupération du salon ${channelId}:`, error);
      // Nettoyer le cache si le salon n'existe plus
      statsChannels.delete(guild.id);
      await GuildSettings.updateOne(
        { guildId: guild.id },
        { $set: { statsChannelId: null } }
      );
      return;
    }

    // 4. Compter les membres non-bots
    let memberCount;
    try {
      // Utiliser directement la propriété memberCount du serveur pour éviter les problèmes de cache
      // et économiser des appels API inutiles
      memberCount = guild.memberCount;
      
      // Si vous voulez vraiment compter les non-bots (attention aux limites d'API)
      // const members = await guild.members.fetch();
      // memberCount = members.filter(m => !m.user.bot).size;
      
      logger.log(`👥 Nombre total de membres: ${memberCount}`);
    } catch (error) {
      logger.error('⚠️ Erreur lors du comptage des membres:', error);
      memberCount = guild.memberCount; // Utiliser le compte total en cas d'erreur
    }

    // 5. Mettre à jour le nom du salon
    const newName = `👥 Membres: ${memberCount}`;
    
    // Vérifier si une mise à jour est nécessaire
    if (channel.name === newName) {
      logger.log('ℹ️ Le nom du salon est déjà à jour');
      return;
    }

    logger.log(`🔄 Mise à jour du nom: "${channel.name}" → "${newName}"`);
    
    try {
      await channel.setName(newName, `Mise à jour du nombre de membres (${new Date().toISOString()})`);
      logger.log('✅ Nom du salon mis à jour avec succès');
    } catch (error) {
      logger.error('❌ Erreur lors de la mise à jour du nom:', {
        code: error.code,
        message: error.message,
        permissions: channel.permissionsFor(me).toArray()
      });
      
      // Nettoyer le cache si le salon n'existe plus ou si le bot n'a plus accès
      if (['Unknown Channel', 'Missing Access', 'Missing Permissions'].includes(error.message)) {
        logger.log('⚠️ Suppression du salon du cache');
        statsChannels.delete(guild.id);
      }
    }
  } catch (error) {
    logger.error('❌ Erreur critique dans updateMemberCount:', error);
  }
}

// Exports
exports.statsChannels = statsChannels;
exports.updateMemberCount = updateMemberCount;

// Charger les salons depuis GuildSettings
exports.initializeStatsChannels = async function() {
  try {
    if (!client) {
      console.error('❌ Client Discord non initialisé dans stats-vocal.js');
      return;
    }

    console.log('🔄 Chargement des salons de statistiques depuis GuildSettings...');
    
    // Charger depuis GuildSettings
    const guildsWithStats = await GuildSettings.find({ statsChannelId: { $ne: null } });
    
    console.log(`🔍 ${guildsWithStats.length} serveur(s) avec des salons de statistiques trouvés`);
    
    // Mettre à jour le cache en mémoire
    for (const guildSettings of guildsWithStats) {
      if (guildSettings.statsChannelId) {
        statsChannels.set(guildSettings.guildId, guildSettings.statsChannelId);
        console.log(`📌 Salon de stats enregistré pour le serveur ${guildSettings.guildId}: ${guildSettings.statsChannelId}`);
      }
    }
    
    // Vérifier que les salons existent bien
    for (const [guildId, channelId] of statsChannels.entries()) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          // Essayer de récupérer le salon
          let channel;
          try {
            channel = await guild.channels.fetch(channelId);
          } catch (error) {
            console.log(`⚠️ Erreur lors de la récupération du salon ${channelId}:`, error.message);
            channel = null;
          }
          
          if (!channel) {
            console.log(`❌ Le salon ${channelId} n'existe plus sur le serveur ${guild.name}, nettoyage...`);
            // Mettre à jour GuildSettings
            await GuildSettings.updateOne(
              { guildId },
              { $set: { statsChannelId: null } }
            );
            statsChannels.delete(guildId);
          } else {
            console.log(`✅ Salon de statistiques vérifié: #${channel.name} (${channel.id}) sur ${guild.name}`);
            // Mettre à jour le compteur immédiatement
            await updateMemberCount(guild);
          }
        } else {
          console.log(`⚠️ Serveur ${guildId} non trouvé dans le cache du client`);
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
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${new Date().toISOString()}] 🔍 VÉRIFICATION DES SALONS EXISTANTS`);
    console.log(`🏠 Serveur: ${guild.name} (${guild.id})`);
    
    // 1. Vérifier d'abord dans le cache
    const existingChannelId = statsChannels.get(guild.id);
    if (existingChannelId) {
      try {
        // Essayer de récupérer le salon depuis le cache ou l'API
        const existingChannel = guild.channels.cache.get(existingChannelId) || 
                              await guild.channels.fetch(existingChannelId).catch(() => null);
        
        if (existingChannel) {
          console.log(`✅ Salon existant trouvé: #${existingChannel.name} (${existingChannel.id})`);
          return { 
            success: false, 
            message: `❌ Un salon de statistiques existe déjà : ${existingChannel}` 
          };
        } else {
          console.log(`ℹ️ Le salon ${existingChannelId} du cache n'existe plus, nettoyage...`);
          statsChannels.delete(guild.id);
        }
      } catch (error) {
        console.error('❌ Erreur lors de la vérification du salon en cache:', error);
        statsChannels.delete(guild.id);
      }
    }

    // 2. Vérifier dans GuildSettings
    console.log(`\n🔍 Vérification dans la base de données...`);
    const guildSettings = await GuildSettings.findOne({ guildId: guild.id });
    
    if (guildSettings?.statsChannelId) {
      try {
        // Essayer de récupérer le salon depuis le cache ou l'API
        const existingChannel = guild.channels.cache.get(guildSettings.statsChannelId) || 
                              await guild.channels.fetch(guildSettings.statsChannelId).catch(() => null);
        
        if (existingChannel) {
          console.log(`✅ Salon existant trouvé dans la base de données: #${existingChannel.name} (${existingChannel.id})`);
          // Mettre à jour le cache
          statsChannels.set(guild.id, existingChannel.id);
          return { 
            success: false, 
            message: `❌ Un salon de statistiques existe déjà : ${existingChannel}` 
          };
        } else {
          console.log(`ℹ️ Le salon ${guildSettings.statsChannelId} de la base de données n'existe plus, nettoyage...`);
          // Nettoyer la base de données
          await GuildSettings.updateOne(
            { guildId: guild.id },
            { $set: { statsChannelId: null } }
          );
        }
      } catch (error) {
        console.error('❌ Erreur lors de la vérification du salon en base de données:', error);
      }
    }

    // 3. Vérifier les permissions
    console.log(`\n🔐 Vérification des permissions...`);
    const me = await guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      const errorMsg = '❌ Je n\'ai pas la permission de gérer les salons sur ce serveur.';
      console.log(errorMsg);
      return { 
        success: false, 
        message: errorMsg
      };
    }

    // 4. Vérifier une dernière fois qu'aucun salon n'existe
    console.log(`\n🔍 Dernière vérification des salons...`);
    const finalCheck = await GuildSettings.findOne({ guildId: guild.id });
    if (finalCheck?.statsChannelId) {
      const existingChannel = guild.channels.cache.get(finalCheck.statsChannelId) || 
                            await guild.channels.fetch(finalCheck.statsChannelId).catch(() => null);
      
      if (existingChannel) {
        console.log(`⚠️ Un salon a été trouvé lors de la vérification finale: #${existingChannel.name} (${existingChannel.id})`);
        statsChannels.set(guild.id, existingChannel.id);
        return { 
          success: false, 
          message: `❌ Un salon de statistiques existe déjà : ${existingChannel}`
        };
      }
    }

    // 5. Créer le salon vocal
    console.log(`\n🔄 Création du salon de statistiques...`);
    try {
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

      console.log(`✅ Salon créé avec succès: #${channel.name} (${channel.id})`);

      // 6. Mettre à jour la base de données
      console.log(`\n💾 Mise à jour de la base de données...`);
      await GuildSettings.findOneAndUpdate(
        { guildId: guild.id },
        { $set: { statsChannelId: channel.id } },
        { upsert: true, new: true }
      );
      console.log(`✅ Base de données mise à jour pour le serveur: ${guild.id}`);

      // 7. Mettre à jour le cache
      statsChannels.set(guild.id, channel.id);
      console.log(`✅ Cache mis à jour pour le serveur: ${guild.id}`);

      // 8. Mettre à jour immédiatement le compteur
      console.log(`\n🔄 Mise à jour initiale du compteur...`);
      await updateMemberCount(guild);

      return { 
        success: true, 
        message: `✅ Salon de statistiques créé avec succès : ${channel}`,
        channel 
      };
    } catch (error) {
      console.error('❌ Erreur lors de la création du salon:', error);
      // Nettoyer en cas d'échec
      statsChannels.delete(guild.id);
      throw error; // Laisser le gestionnaire d'erreur global gérer
    }
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
