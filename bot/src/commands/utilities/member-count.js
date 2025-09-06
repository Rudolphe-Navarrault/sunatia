const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createStatsChannel } = require('../../utils/stats-vocal');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('member-count')
    .setDescription('Crée un salon vocal affichant le nombre de membres du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  async execute(interaction) {
    // Répondre immédiatement pour éviter l'erreur "Interaction has already been acknowledged"
    await interaction.deferReply({ ephemeral: true });

    const { guild } = interaction;

    try {
      // Vérifier les permissions du bot
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({
          content: "❌ Je n'ai pas la permission de gérer les salons."
        });
      }

      // Créer ou récupérer le salon de statistiques
      const result = await createStatsChannel(guild);
      
      // Répondre avec le résultat
      await interaction.editReply({
        content: result.message
      });

    } catch (error) {
      logger.error('Erreur lors de la création du salon de statistiques:', error);
      
      // Essayer de répondre avec un message d'erreur
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Une erreur est survenue lors de la création du salon.',
            ephemeral: true
          });
        } else {
          await interaction.editReply({
            content: '❌ Une erreur est survenue lors de la création du salon.'
          });
        }
      } catch (replyError) {
        logger.error('Erreur lors de l\'envoi du message d\'erreur:', replyError);
      }
    }
  }
};
