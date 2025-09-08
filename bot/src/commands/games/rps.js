const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const buttonsHandler = require('../../interactionHandlers/buttons/rps');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Jouer à Pierre-Feuille-Ciseaux')
    .addUserOption((option) =>
      option
        .setName('adversaire')
        .setDescription('Choisis un adversaire (laisser vide pour jouer contre Sunatia)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const opponent = interaction.options.getUser('adversaire') || interaction.client.user; // Bot si pas choisi

    if (opponent.id === interaction.user.id)
      return interaction.reply({
        content: 'Tu ne peux pas jouer contre toi-même !',
        ephemeral: true,
      });

    // Embed initial
    const embed = new EmbedBuilder()
      .setTitle('🎮 Pierre-Feuille-Ciseaux')
      .setDescription(`${interaction.user} vs ${opponent}\nChoisis ton coup !`)
      .setColor('Blue');

    // Boutons pour choisir
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rps_pierre')
        .setLabel('🪨 Pierre')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('rps_feuille')
        .setLabel('📄 Feuille')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('rps_ciseaux')
        .setLabel('✂️ Ciseaux')
        .setStyle(ButtonStyle.Primary)
    );

    // Envoyer le message et récupérer l'objet Message
    const message = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    // Initialiser le jeu actif dans le handler des boutons
    buttonsHandler.createGame(message, opponent.id, interaction.client);
  },
};
