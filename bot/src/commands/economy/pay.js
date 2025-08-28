const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Coins = require('../../models/Coins');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Paye un autre utilisateur avec tes pièces !')
    .addUserOption((option) =>
      option.setName('user').setDescription('L’utilisateur à payer').setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName('amount').setDescription('Montant à payer').setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch {
      console.warn('⚠️ deferReply échoué (interaction expirée ?) Unknown interaction');
    }

    const payer = interaction.user;
    const receiver = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (receiver.id === payer.id) {
      return interaction.editReply({ content: '❌ Tu ne peux pas te payer toi-même !' });
    }

    if (amount <= 0) {
      return interaction.editReply({ content: '❌ Le montant doit être supérieur à 0.' });
    }

    try {
      // Récupérer ou créer le payer
      let payerData = await Coins.findOrCreate({ userId: payer.id, guildId: interaction.guild.id });
      if (payerData.balance < amount) {
        return interaction.editReply({
          content: '❌ Solde insuffisant pour effectuer le paiement.',
        });
      }

      // Récupérer ou créer le receiver
      let receiverData = await Coins.findOrCreate({
        userId: receiver.id,
        guildId: interaction.guild.id,
      });

      // Retirer de payer (sans toucher totalEarned)
      payerData.balance -= amount;
      await payerData.save();

      // Ajouter au receiver (et ajouter au totalEarned)
      receiverData.balance += amount;
      receiverData.totalEarned += amount;
      await receiverData.save();

      // Embed pour confirmation
      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('💸 Paiement effectué !')
        .setDescription(
          `${payer.username} a payé **${amount.toLocaleString()}** pièces à ${receiver.username} !`
        )
        .addFields(
          {
            name: '💰 Nouveau solde',
            value: `${payer.username} : ${payerData.balance.toLocaleString()} pièces\n${receiver.username} : ${receiverData.balance.toLocaleString()} pièces`,
          },
          {
            name: '✨ Total gagné du receveur',
            value: `${receiver.username} : ${receiverData.totalEarned.toLocaleString()} pièces`,
          }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Erreur pay:', error);
      return interaction.editReply({ content: '❌ Une erreur est survenue lors du paiement.' });
    }
  },
};
