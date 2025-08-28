const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Coins = require('../../models/Coins');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Voir ton solde ou celui d’un autre utilisateur')
    .addUserOption((option) =>
      option
        .setName('utilisateur')
        .setDescription('L’utilisateur dont tu veux voir le solde')
        .setRequired(false)
    ),

  async execute(interaction) {
    // Déférer la réponse pour éviter expiration
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch {
      console.warn('⚠️ deferReply échoué (interaction expirée ?) Unknown interaction');
    }

    try {
      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

      // Chercher ou créer l'utilisateur
      let userCoins = await Coins.findOne({ userId: targetUser.id, guildId: interaction.guild.id });
      if (!userCoins) {
        userCoins = new Coins({
          userId: targetUser.id,
          guildId: interaction.guild.id,
          balance: 0,
          lastDaily: null,
        });
        await userCoins.save();
      }

      // Créer l'embed
      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`💰 Solde de ${targetUser.username}`)
        .addFields(
          {
            name: '💰 Pièces',
            value: `${userCoins.balance.toLocaleString()} pièces`,
            inline: true,
          },
          {
            name: '✨ Total gagné',
            value: `${userCoins.totalEarned.toLocaleString()} pièces`,
            inline: true,
          }
        )
        .setFooter({ text: 'Utilise /daily pour réclamer ta récompense quotidienne !' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Erreur balance:', error);
      try {
        return interaction.editReply({
          content: '❌ Une erreur est survenue. Réessaie plus tard.',
        });
      } catch {
        if (interaction.channel)
          interaction.channel.send('❌ Une erreur est survenue avec la commande balance.');
      }
    }
  },
};
