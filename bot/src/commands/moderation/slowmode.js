const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

// Durées disponibles pour le mode lent (en secondes)
const DURATIONS = [
  { name: 'Désactivé', value: 0 },
  { name: '5 secondes', value: 5 },
  { name: '10 secondes', value: 10 },
  { name: '15 secondes', value: 15 },
  { name: '30 secondes', value: 30 },
  { name: '1 minute', value: 60 },
  { name: '2 minutes', value: 120 },
  { name: '5 minutes', value: 300 },
  { name: '10 minutes', value: 600 },
  { name: '15 minutes', value: 900 },
  { name: '30 minutes', value: 1800 },
  { name: '1 heure', value: 3600 },
  { name: '2 heures', value: 7200 },
  { name: '6 heures', value: 21600 }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Active ou désactive le mode lent dans un salon')
    .addIntegerOption(option =>
      option.setName('duree')
        .setDescription('Durée du mode lent')
        .setRequired(true)
        .addChoices(...DURATIONS.map(d => ({ name: d.name, value: d.value })))
    )
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Salon à modifier (par défaut: le salon actuel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildPublicThread, ChannelType.GuildPrivateThread)
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison du mode lent')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  async execute(interaction) {
    const duration = interaction.options.getInteger('duree');
    const channel = interaction.options.getChannel('salon') || interaction.channel;
    const reason = interaction.options.getString('raison');
    const { user } = interaction;

    // Vérifier les permissions du bot
    if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ Je n\'ai pas la permission de modifier ce salon.',
        ephemeral: true
      });
    }

    // Vérifier les permissions de l'utilisateur
    if (!channel.permissionsFor(interaction.member).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ Vous n\'avez pas la permission de modifier ce salon.',
        ephemeral: true
      });
    }

    try {
      // Appliquer le mode lent
      await channel.setRateLimitPerUser(duration, `${user.tag} | ${reason || 'Aucune raison fournie'}`);

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setColor(duration > 0 ? '#FFA500' : '#4CAF50')
        .setTitle('⏱️ Mode lent mis à jour')
        .setDescription(`Le mode lent a été ${duration > 0 ? 'activé' : 'désactivé'} dans ${channel}.`)
        .addFields(
          { name: 'Durée', value: duration > 0 ? this.formatDuration(duration) : 'Désactivé', inline: true },
          { name: 'Modérateur', value: user.toString(), inline: true }
        )
        .setTimestamp();

      if (reason) {
        embed.addFields({ name: 'Raison', value: reason, inline: false });
      }

      // Envoyer la confirmation
      await interaction.reply({ 
        embeds: [embed],
        ephemeral: true 
      });

      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a défini le mode lent à ${duration}s dans #${channel.name} (${channel.id}). Raison: ${reason || 'Aucune'}`);

    } catch (error) {
      logger.error('Erreur lors de la modification du mode lent:', error);
      
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la modification du mode lent.',
        ephemeral: true
      });
    }
  },

  /**
   * Formate une durée en secondes en chaîne lisible
   * @param {number} seconds - Durée en secondes
   * @returns {string} Durée formatée
   */
  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds} seconde${seconds > 1 ? 's' : ''}`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    
    const hours = Math.floor(minutes / 60);
    return `${hours} heure${hours > 1 ? 's' : ''}`;
  }
};
