const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Supprime un nombre spécifié de messages dans le salon actuel')
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de messages à supprimer (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Ne supprimer que les messages de ce membre')
    )
    .addStringOption(option =>
      option.setName('contenu')
        .setDescription('Ne supprimer que les messages contenant ce texte')
    )
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Salon où supprimer les messages (par défaut: le salon actuel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildPublicThread, ChannelType.GuildPrivateThread)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  async execute(interaction) {
    const amount = interaction.options.getInteger('nombre');
    const targetUser = interaction.options.getUser('membre');
    const contentFilter = interaction.options.getString('contenu')?.toLowerCase();
    const channel = interaction.options.getChannel('salon') || interaction.channel;
    const { user } = interaction;

    // Vérifier les permissions du bot
    if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: '❌ Je n\'ai pas la permission de supprimer des messages dans ce salon.',
        ephemeral: true
      });
    }

    // Vérifier les permissions de l'utilisateur
    if (!channel.permissionsFor(interaction.member).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: '❌ Vous n\'avez pas la permission de supprimer des messages dans ce salon.',
        ephemeral: true
      });
    }

    try {
      // Désactiver la réponse différée (pour éviter le timeout)
      await interaction.deferReply({ ephemeral: true });

      let messages = [];
      let lastId;
      let count = 0;
      const maxAttempts = 5; // Nombre maximum de tentatives de récupération
      let attempts = 0;

      // Récupérer les messages par lots de 100 (limite de l'API Discord)
      while (count < amount && attempts < maxAttempts) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        // eslint-disable-next-line no-await-in-loop
        const fetched = await channel.messages.fetch(options);
        if (fetched.size === 0) break;

        // Filtrer les messages selon les critères
        const filtered = fetched.filter(msg => {
          // Ne pas supprimer les messages épinglés
          if (msg.pinned) return false;
          
          // Filtrer par utilisateur si spécifié
          if (targetUser && msg.author.id !== targetUser.id) return false;
          
          // Filtrer par contenu si spécifié
          if (contentFilter && !msg.content.toLowerCase().includes(contentFilter)) return false;
          
          return true;
        });

        // Ajouter les messages filtrés à la liste
        messages = messages.concat(Array.from(filtered.values()));
        count = messages.length;
        
        // Mettre à jour l'ID du dernier message pour la prochaine itération
        lastId = fetched.last().id;
        attempts++;
      }

      // Limiter au nombre demandé
      messages = messages.slice(0, amount);

      if (messages.length === 0) {
        return interaction.editReply({
          content: '❌ Aucun message ne correspond aux critères de recherche.'
        });
      }

      // Supprimer les messages par lots de 100 (limite de l'API)
      const BATCH_SIZE = 100;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        // eslint-disable-next-line no-await-in-loop
        await channel.bulkDelete(batch, true);
      }

      // Construire le message de confirmation
      let confirmationMessage = `✅ ${messages.length} message(s) ont été supprimés`;
      if (targetUser) confirmationMessage += ` de ${targetUser.tag}`;
      if (contentFilter) confirmationMessage += ` contenant "${contentFilter}"`;
      confirmationMessage += ` dans ${channel}.`;

      // Envoyer la confirmation
      await interaction.editReply({
        content: confirmationMessage
      });

      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a supprimé ${messages.length} message(s) dans #${channel.name} (${channel.id})`);

    } catch (error) {
      logger.error('Erreur lors de la suppression des messages:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: '❌ Une erreur est survenue lors de la suppression des messages.',
          ephemeral: true
        });
      }
      
      await interaction.editReply({
        content: '❌ Une erreur est survenue lors de la suppression des messages. Certains messages peuvent avoir été supprimés.'
      });
    }
  }
};
