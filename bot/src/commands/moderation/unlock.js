const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionOverwrites, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Déverrouille un salon précédemment verrouillé')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Salon à déverrouiller (par défaut: salon actuel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildPublicThread, ChannelType.GuildPrivateThread)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Rôle à affecter (par défaut: @everyone)')
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison du déverrouillage')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  async execute(interaction) {
    const { client, user } = interaction;
    const channel = interaction.options.getChannel('salon') || interaction.channel;
    const role = interaction.options.getRole('role') || interaction.guild.roles.everyone;
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';

    // Vérifier les permissions du bot
    if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ Je n\'ai pas la permission de gérer ce salon.',
        ephemeral: true
      });
    }

    // Vérifier les permissions de l'utilisateur
    if (!channel.permissionsFor(interaction.member).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ Vous n\'avez pas la permission de gérer ce salon.',
        ephemeral: true
      });
    }

    try {
      // Vérifier si le salon est verrouillé
      const currentPerms = channel.permissionOverwrites.cache.get(role.id);
      const isLocked = currentPerms?.deny.has(PermissionFlagsBits.SendMessages);
      
      if (!isLocked) {
        return interaction.reply({
          content: `❌ Le salon ${channel} n'est pas verrouillé pour le rôle ${role}.`,
          ephemeral: true
        });
      }

      // Récupérer les métadonnées du verrouillage depuis le stockage en mémoire
      const lockData = client.lockedChannels?.get(channel.id);
      const previousState = lockData?.previousState;

      // Restaurer les permissions précédentes si elles existent
      if (previousState) {
        // Convertir les chaînes de bits en BigInt
        const allow = BigInt(previousState.allow);
        const deny = BigInt(previousState.deny);
        
        // Créer un nouvel objet de permissions
        const newPermissions = new PermissionOverwrites(interaction.guild, {
          id: role.id,
          type: 0, // 0 pour rôle, 1 pour membre
          allow: allow,
          deny: deny
        });
        
        // Appliquer les permissions
        await channel.permissionOverwrites.create(role, newPermissions, {
          reason: `Déverrouillage par ${user.tag} | ${reason}`
        });
      } else {
        // Si aucune métadonnée trouvée, réinitialiser les permissions
        await channel.permissionOverwrites.edit(role, {
          SendMessages: null,
          AddReactions: null,
          CreatePublicThreads: null,
          CreatePrivateThreads: null,
          SendMessagesInThreads: null,
          SendTTSMessages: null,
          AttachFiles: null,
          EmbedLinks: null
        }, {
          reason: `Déverrouillage par ${user.tag} | ${reason}`,
          type: 0 // 0 pour rôle, 1 pour membre
        });
      }

      // Supprimer les métadonnées de verrouillage du stockage
      if (client.lockedChannels?.has(channel.id)) {
        client.lockedChannels.delete(channel.id);
      }

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🔓 Salon déverrouillé')
        .setDescription(`Le salon ${channel} a été déverrouillé pour le rôle ${role}.`)
        .addFields(
          { name: 'Modérateur', value: user.toString(), inline: true },
          { name: 'Raison', value: reason, inline: true }
        )
        .setTimestamp();

      // Envoyer la confirmation
      await interaction.reply({ 
        embeds: [embed],
        ephemeral: true 
      });

      // Envoyer une notification dans le salon
      try {
        await channel.send({ embeds: [embed] });
      } catch (error) {
        logger.warn(`Impossible d'envoyer la notification de déverrouillage dans le salon ${channel.id}`);
      }

      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a déverrouillé le salon #${channel.name} (${channel.id}) pour le rôle ${role.name} (${role.id}). Raison: ${reason}`);

    } catch (error) {
      logger.error('Erreur lors du déverrouillage du salon:', error);
      
      await interaction.reply({
        content: '❌ Une erreur est survenue lors du déverrouillage du salon.',
        ephemeral: true
      });
    }
  }
};
