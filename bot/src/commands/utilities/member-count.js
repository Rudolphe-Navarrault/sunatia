const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createStatsChannel, statsChannels } = require('../../utils/stats-vocal');
const { GuildSettings } = require('../../models/GuildSettings');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('member-count')
    .setDescription('Crée un salon vocal affichant le nombre de membres du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addStringOption(option =>
      option
        .setName('action')
        .setDescription('Action à effectuer')
        .addChoices(
          { name: 'Créer', value: 'create' },
          { name: 'Supprimer', value: 'delete' }
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    // Répondre immédiatement pour éviter l'erreur "Interaction has already been acknowledged"
    await interaction.deferReply({ ephemeral: true });

    const { guild, options } = interaction;
    const action = options.getString('action') || 'create';

    try {
      // Vérifier les permissions du bot
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({
          content: "❌ Je n'ai pas la permission de gérer les salons sur ce serveur."
        });
      }

      // Vérifier si un salon existe déjà
      const existingChannelId = statsChannels.get(guild.id);
      const guildSettings = await GuildSettings.findOne({ guildId: guild.id });
      const existingChannel = existingChannelId ? 
        (guild.channels.cache.get(existingChannelId) || 
         await guild.channels.fetch(existingChannelId).catch(() => null)) : null;

      // Action de suppression
      if (action === 'delete') {
        if (!existingChannel && !guildSettings?.statsChannelId) {
          return interaction.editReply({
            content: '❌ Aucun salon de statistiques à supprimer.'
          });
        }

        // Nettoyer le cache et la base de données
        statsChannels.delete(guild.id);
        await GuildSettings.updateOne(
          { guildId: guild.id },
          { $unset: { statsChannelId: 1 } }
        );

        // Supprimer le salon s'il existe encore
        if (existingChannel) {
          try {
            await existingChannel.delete('Suppression du salon de statistiques');
          } catch (error) {
            logger.error('Erreur lors de la suppression du salon:', error);
          }
        }

        return interaction.editReply({
          content: '✅ Le salon de statistiques a été supprimé avec succès.'
        });
      }

      // Action de création (par défaut)
      
      // Vérifier s'il existe déjà un salon de statistiques
      if (existingChannel || guildSettings?.statsChannelId) {
        // Mettre à jour le cache si nécessaire
        if (guildSettings?.statsChannelId && !existingChannel) {
          statsChannels.set(guild.id, guildSettings.statsChannelId);
        }
        
        // Vérifier si le salon existe toujours
        const channelToCheck = existingChannel || 
          (guildSettings?.statsChannelId ? 
            await guild.channels.fetch(guildSettings.statsChannelId).catch(() => null) : null);
        
        if (channelToCheck) {
          return interaction.editReply({
            content: `❌ Un salon de statistiques existe déjà : ${channelToCheck}`
          });
        }
      }

      // Vérifier s'il y a déjà un salon de statistiques dans les salons existants
      const allVoiceChannels = await guild.channels.fetch().then(channels => 
        channels.filter(c => c.type === ChannelType.GuildVoice)
      );
      
      const existingVoiceChannels = allVoiceChannels.filter(
        c => c.name.startsWith('👥 Membres:') || c.name.startsWith('Membres:')
      );

      if (existingVoiceChannels.size > 0) {
        const existingChannel = existingVoiceChannels.first();
        // Mettre à jour la base de données et le cache
        await GuildSettings.findOneAndUpdate(
          { guildId: guild.id },
          { $set: { statsChannelId: existingChannel.id } },
          { upsert: true }
        );
        statsChannels.set(guild.id, existingChannel.id);
        
        return interaction.editReply({
          content: `⚠️ Un salon de statistiques existant a été trouvé et récupéré : ${existingChannel}`
        });
      }

      // Créer un nouveau salon de statistiques
      const result = await createStatsChannel(guild);
      
      // Répondre avec le résultat
      await interaction.editReply({
        content: result.message
      });

    } catch (error) {
      logger.error('Erreur lors de la gestion du salon de statistiques:', error);
      
      // Essayer de répondre avec un message d'erreur
      try {
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors de la gestion du salon de statistiques.'
        });
      } catch (replyError) {
        logger.error('Erreur lors de l\'envoi du message d\'erreur:', replyError);
      }
    }
  }
};
