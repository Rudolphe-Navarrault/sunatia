const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../../models/User');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('localite')
    .setDescription('Gérer votre localité')
    .setDMPermission(false)
    .addSubcommand(subcommand =>
      subcommand
        .setName('definir')
        .setDescription('Définir votre localité')
        .addStringOption(option =>
          option
            .setName('ville')
            .setDescription('Votre ville ou région')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('supprimer')
        .setDescription('Supprimer votre localité')
    ),

  async execute(interaction) {
    const { user, guildId, options } = interaction;
    const subcommand = options.getSubcommand();

    try {
      // Trouver ou créer l'utilisateur
      const userDoc = await User.findOrCreate({
        userId: user.id,
        guildId: guildId,
        username: user.username,
        discriminator: user.discriminator,
        bot: user.bot
      });

      if (subcommand === 'definir') {
        const location = options.getString('ville');
        
        // Vérifier la longueur de la localité
        if (location.length > 50) {
          return interaction.reply({
            content: '❌ La localité ne peut pas dépasser 50 caractères.',
            ephemeral: true
          });
        }

        // Définir la localité
        await userDoc.setLocation(location);
        
        await interaction.reply({
          content: `✅ Votre localité a été définie sur : **${location}**`,
          ephemeral: true
        });

      } else if (subcommand === 'supprimer') {
        // Supprimer la localité
        await userDoc.setLocation(null);
        
        await interaction.reply({
          content: '✅ Votre localité a été supprimée.',
          ephemeral: true
        });
      }

    } catch (error) {
      console.error('Erreur lors de la gestion de la localité:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la gestion de votre localité.',
        ephemeral: true
      });
    }
  }
};
