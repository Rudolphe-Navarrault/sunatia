// commands/admin/setup-welcome.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { GuildSettings } = require('../../models/GuildSettings');
const logger = require('../../utils/logger');

// --- Utilitaire pour éviter InteractionAlreadyReplied ---
async function safeReply(interaction, options) {
  try {
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply(options).catch(() => {});
    } else {
      return interaction.reply(options).catch(() => {});
    }
  } catch (err) {
    logger.error('Erreur dans safeReply:', err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-welcome')
    .setDescription('Définit le salon de bienvenue du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('salon')
        .setDescription('Le salon où seront envoyés les messages de bienvenue')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const channel = interaction.options.getChannel('salon');
      const guildId = interaction.guildId;

      // Mise à jour du GuildSettings
      await GuildSettings.findOneAndUpdate(
        { guildId },
        { $set: { welcomeChannelId: channel.id } },
        { new: true, upsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor('#00ff9d')
        .setTitle('✅ Salon de bienvenue configuré')
        .setDescription(`Les nouveaux membres recevront désormais un message dans ${channel}.`)
        .setFooter({ text: `Serveur: ${interaction.guild.name}` })
        .setTimestamp();

      await safeReply(interaction, { embeds: [embed], ephemeral: true });
      logger.info(
        `[Welcome] Salon de bienvenue défini pour ${interaction.guild.name} (${guildId}): ${channel.id}`
      );
    } catch (err) {
      logger.error('Erreur lors de la configuration du salon de bienvenue:', err);
      await safeReply(interaction, {
        content: '❌ Une erreur est survenue lors de la configuration.',
        ephemeral: true,
      });
    }
  },
};
