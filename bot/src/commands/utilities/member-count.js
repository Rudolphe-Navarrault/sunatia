const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createStatsChannel } = require('../../utils/stats-vocal');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('member-count')
    .setDescription('Crée un salon vocal affichant le nombre de membres du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  async execute(interaction) {
    const { guild, member } = interaction;

    if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "❌ Je n'ai pas la permission de gérer les salons.",
        ephemeral: true,
      });
    }

    try {
      const result = await createStatsChannel(guild);
      
      if (result.success) {
        await interaction.reply({
          content: result.message,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: result.message,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('Erreur lors de la création du salon de statistiques:', error);
      interaction
        .reply({
          content: '❌ Une erreur est survenue lors de la création du salon.',
          ephemeral: true,
        })
        .catch(console.error);
    }
  },

  // Méthode pour mettre à jour le compteur (déplacée dans stats-vocal.js)
  // Utilisez directement updateMemberCount depuis stats-vocal.js
};
