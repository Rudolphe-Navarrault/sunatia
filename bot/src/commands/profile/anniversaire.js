const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anniversaire')
    .setDescription('Définir ou mettre à jour votre date d\'anniversaire')
    .addIntegerOption(option =>
      option.setName('jour')
        .setDescription('Le jour de votre anniversaire (1-31)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(31)
    )
    .addIntegerOption(option =>
      option.setName('mois')
        .setDescription('Le mois de votre anniversaire (1-12)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(12)
    )
    .addIntegerOption(option =>
      option.setName('année')
        .setDescription('Votre année de naissance (optionnel)')
        .setRequired(false)
        .setMinValue(1900)
        .setMaxValue(new Date().getFullYear() - 5)
    ),

  category: 'profile',

  async execute(interaction) {
    const day = interaction.options.getInteger('jour');
    const month = interaction.options.getInteger('mois');
    const year = interaction.options.getInteger('année');

    try {
      // Récupérer ou créer l'utilisateur
      const user = await User.findOrCreate({
        userId: interaction.user.id,
        guildId: interaction.guildId,
        username: interaction.user.username,
        discriminator: interaction.user.discriminator,
        bot: interaction.user.bot
      });

      // Définir l'anniversaire
      await user.setBirthday(day, month, year || null);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('🎂 Anniversaire mis à jour')
        .setDescription(`Votre date d'anniversaire a été définie au ${user.getBirthday()}`)
        .setFooter({ text: 'Cette information sera visible sur votre profil' });

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'anniversaire:', error);
      
      let errorMessage = '❌ Une erreur est survenue lors de la mise à jour de votre anniversaire.';
      if (error.message === 'Date d\'anniversaire invalide') {
        errorMessage = '❌ Date d\'anniversaire invalide. Veuillez vérifier le jour et le mois.';
      }

      await interaction.reply({
        content: errorMessage,
        ephemeral: true
      });
    }
  },
};
