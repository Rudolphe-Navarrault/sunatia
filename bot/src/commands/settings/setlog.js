const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { GuildSettings } = require('../../models/GuildSettings');
const logger = require('../../utils/logger');

// Liste des types de logs disponibles
const LOG_TYPES = {
  // Commandes de modération
  ban: 'Bannissements',
  unban: 'Débannissements',
  kick: 'Exclusions',
  mute: 'Muet',
  warn: 'Avertissements',
  purge: 'Purges de messages',
  lock: 'Verrouillages',
  unlock: 'Déverrouillages',
  slowmode: 'Mode lent',
  
  // Commandes temporaires
  tempmute: 'Muet temporaire',
  tempban: 'Bannissement temporaire',
  tempwarn: 'Avertissement temporaire',
  
  // Autres événements
  memberUpdate: 'Mises à jour de membres',
  messageDelete: 'Messages supprimés',
  messageUpdate: 'Messages modifiés',
  roleCreate: 'Rôles créés',
  roleDelete: 'Rôles supprimés',
  roleUpdate: 'Rôles mis à jour',
  channelCreate: 'Salons créés',
  channelDelete: 'Salons supprimés',
  channelUpdate: 'Salons mis à jour',
  
  // Spécial
  all: 'Tous les logs'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('Configure les logs de modération')
    .addSubcommand(subcommand =>
      subcommand
        .setName('channel')
        .setDescription('Définit le salon pour un type de log spécifique')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type de log à configurer')
            .setRequired(true)
            .addChoices(
              ...Object.entries(LOG_TYPES).map(([value, name]) => ({ name, value }))
            )
        )
        .addChannelOption(option =>
          option.setName('salon')
            .setDescription('Salon où envoyer les logs (laissez vide pour désactiver)')
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Active ou désactive un type de log')
        .addStringOption(option =>
          option.setName('type')
            .setDescription('Type de log à activer/désactiver')
            .setRequired(true)
            .addChoices(
              ...Object.entries(LOG_TYPES)
                .filter(([key]) => key !== 'all')
                .map(([value, name]) => ({ name, value }))
            )
        )
        .addBooleanOption(option =>
          option.setName('etat')
            .setDescription('Activer ou désactiver ce type de log')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Affiche la configuration actuelle des logs')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '❌ Vous devez avoir la permission de gérer le serveur pour utiliser cette commande.',
        ephemeral: true
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const { guild } = interaction;

    // Récupérer ou créer la configuration du serveur
    let settings = await GuildSettings.findOne({ guildId: guild.id });
    if (!settings) {
      settings = new GuildSettings({ guildId: guild.id });
      await settings.save();
    }

    try {
      if (subcommand === 'channel') {
        await handleChannelSubcommand(interaction, settings);
      } else if (subcommand === 'toggle') {
        await handleToggleSubcommand(interaction, settings);
      } else if (subcommand === 'config') {
        await handleConfigSubcommand(interaction, settings);
      }
    } catch (error) {
      logger.error('Erreur dans la commande setlog:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
        ephemeral: true
      });
    }
  }
};

// Gestion de la sous-commande 'channel'
async function handleChannelSubcommand(interaction, settings) {
  const logType = interaction.options.getString('type');
  const channel = interaction.options.getChannel('salon');
  
  // Mettre à jour la configuration
  if (logType === 'all') {
    // Mettre à jour le canal de logs global
    settings.moderation.logChannelId = channel ? channel.id : null;
    
    // Mettre à jour tous les canaux individuels
    Object.keys(settings.moderation.logSettings).forEach(key => {
      if (channel) {
        settings.moderation.logSettings[key].channelId = channel.id;
      } else {
        settings.moderation.logSettings[key].channelId = null;
      }
    });
    
    await settings.save();
    
    const response = channel 
      ? `✅ Tous les logs seront maintenant envoyés dans ${channel}`
      : '✅ Tous les logs ont été désactivés';
    
    return interaction.reply({
      content: response,
      ephemeral: true
    });
  } else {
    // Mettre à jour un type de log spécifique
    if (!settings.moderation.logSettings[logType]) {
      return interaction.reply({
        content: '❌ Type de log non valide.',
        ephemeral: true
      });
    }
    
    // Debug: Afficher l'état avant la mise à jour
    logger.debug('Avant la mise à jour:', {
      logType,
      channel: channel ? channel.id : null,
      currentSettings: settings.moderation.logSettings[logType]
    });
    
    // Mettre à jour le canal
    settings.markModified('moderation');
    settings.moderation.logSettings[logType].channelId = channel ? channel.id : null;
    settings.moderation.logSettings[logType].enabled = true;
    
    // Sauvegarder et vérifier le résultat
    const saved = await settings.save();
    
    // Debug: Afficher l'état après la sauvegarde
    logger.debug('Après la sauvegarde:', {
      logType,
      savedSettings: saved.moderation.logSettings[logType],
      rawSettings: saved.toObject().moderation.logSettings[logType]
    });
    
    const response = channel
      ? `✅ Les logs de type "${LOG_TYPES[logType]}" seront maintenant envoyés dans ${channel}`
      : `✅ Les logs de type "${LOG_TYPES[logType]}" ont été désactivés`;
    
    return interaction.reply({
      content: response,
      ephemeral: true
    });
  }
}

// Gestion de la sous-commande 'toggle'
async function handleToggleSubcommand(interaction, settings) {
  const logType = interaction.options.getString('type');
  const state = interaction.options.getBoolean('etat');
  
  if (!settings.moderation.logSettings[logType]) {
    return interaction.reply({
      content: '❌ Type de log non valide.',
      ephemeral: true
    });
  }
  
  // Mettre à jour l'état du log
  settings.moderation.logSettings[logType].enabled = state;
  await settings.save();
  
  const response = state
    ? `✅ Les logs de type "${LOG_TYPES[logType]}" ont été activés`
    : `✅ Les logs de type "${LOG_TYPES[logType]}" ont été désactivés`;
  
  return interaction.reply({
    content: response,
    ephemeral: true
  });
}

// Gestion de la sous-commande 'config'
async function handleConfigSubcommand(interaction, settings) {
  const embed = new EmbedBuilder()
    .setTitle('⚙️ Configuration des logs de modération')
    .setColor('#3498db')
    .setDescription('Configuration actuelle des logs de modération pour ce serveur.')
    .addFields(
      {
        name: '🔧 Paramètres généraux',
        value: `Canal de logs global: ${
          settings.moderation.logChannelId 
            ? `<#${settings.moderation.logChannelId}>` 
            : 'Non défini (utilise le canal par défaut si disponible)'
        }`,
        inline: false
      },
      {
        name: '📋 Configuration des logs',
        value: 'Voici la configuration actuelle pour chaque type de log :',
        inline: false
      }
    );
    
  // Grouper les logs par catégorie
  const categories = {
    '🔨 Modération': ['ban', 'unban', 'kick', 'mute', 'warn', 'purge', 'lock', 'unlock', 'slowmode'],
    '⏱️ Temporaire': ['tempmute', 'tempban', 'tempwarn'],
    '👥 Membre': ['memberUpdate'],
    '💬 Messages': ['messageDelete', 'messageUpdate'],
    '🛡️ Rôles': ['roleCreate', 'roleDelete', 'roleUpdate'],
    '📁 Salons': ['channelCreate', 'channelDelete', 'channelUpdate']
  };
  
  // Ajouter chaque catégorie à l'embed
  for (const [category, types] of Object.entries(categories)) {
    const fields = [];
    
    for (const type of types) {
      const config = settings.moderation.logSettings[type];
      const status = config.enabled ? '✅' : '❌';
      const channel = config.channelId ? `<#${config.channelId}>` : 'Par défaut';
      
      fields.push(`${status} **${LOG_TYPES[type]}**: ${channel}`);
    }
    
    embed.addFields({
      name: category,
      value: fields.join('\n') || 'Aucun log configuré',
      inline: false
    });
  }
  
  // Ajouter des instructions
  embed.addFields({
    name: 'ℹ️ Comment configurer',
    value: 'Utilisez `/setlog channel` pour définir un canal de logs spécifique.\n' +
           'Utilisez `/setlog toggle` pour activer ou désactiver un type de log.',
    inline: false
  });
  
  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}
