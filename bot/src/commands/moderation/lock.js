const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionOverwrites, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Verrouille un salon pour empêcher les membres d\'envoyer des messages')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Salon à verrouiller (par défaut: salon actuel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildPublicThread, ChannelType.GuildPrivateThread)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Rôle à affecter (par défaut: @everyone)')
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison du verrouillage')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  async execute(interaction) {
    const { client } = interaction;
    const channel = interaction.options.getChannel('salon') || interaction.channel;
    const role = interaction.options.getRole('role') || interaction.guild.roles.everyone;
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { user } = interaction;

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
      // Vérifier si le salon est déjà verrouillé
      const currentPerms = channel.permissionOverwrites.cache.get(role.id);
      const isLocked = currentPerms?.deny.has(PermissionFlagsBits.SendMessages);
      
      if (isLocked) {
        return interaction.reply({
          content: `❌ Le salon ${channel} est déjà verrouillé pour le rôle ${role}.`,
          ephemeral: true
        });
      }

      // Sauvegarder les permissions actuelles dans les métadonnées
      const currentOverwrites = channel.permissionOverwrites.cache.get(role.id);
      const previousState = {
        allow: currentOverwrites?.allow.bitfield || 0n,
        deny: currentOverwrites?.deny.bitfield || 0n
      };

      // Appliquer le verrouillage
      await channel.permissionOverwrites.edit(role, {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        SendMessagesInThreads: false,
        SendTTSMessages: false,
        AttachFiles: false,
        EmbedLinks: false
      }, {
        reason: `Verrouillage par ${user.tag} | ${reason}`,
        type: 0 // 0 pour rôle, 1 pour membre
      });

      // Sauvegarder l'état précédent dans la base de données ou le stockage local
      // Note: Cette implémentation utilise un stockage en mémoire
      // Pour une solution plus robuste, utilisez une base de données
      if (!client.lockedChannels) client.lockedChannels = new Map();
      
      client.lockedChannels.set(channel.id, {
        lockedBy: user.id,
        lockedAt: new Date().toISOString(),
        roleId: role.id,
        previousState: {
          allow: previousState.allow.toString(),
          deny: previousState.deny.toString()
        },
        reason
      });

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔒 Salon verrouillé')
        .setDescription(`Le salon ${channel} a été verrouillé pour le rôle ${role}.`)
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
        logger.warn(`Impossible d'envoyer la notification de verrouillage dans le salon ${channel.id}`);
      }

      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a verrouillé le salon #${channel.name} (${channel.id}) pour le rôle ${role.name} (${role.id}). Raison: ${reason}`);

    } catch (error) {
      logger.error('Erreur lors du verrouillage du salon:', error);
      
      await interaction.reply({
        content: '❌ Une erreur est survenue lors du verrouillage du salon.',
        ephemeral: true
      });
    }
  }
};
