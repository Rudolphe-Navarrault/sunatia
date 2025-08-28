const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Currency = require('../../models/Currency');

// Montant de la récompense quotidienne (à ajuster selon vos besoins)
const DAILY_AMOUNT = 100;
// Temps d'attente entre deux récompenses (24 heures en millisecondes)
const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Récupérez votre récompense quotidienne !'),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;
      
      const userCurrency = await Currency.getUser(userId, guildId);
      const now = new Date();
      
      // Vérifier si l'utilisateur peut réclamer sa récompense
      if (userCurrency.lastDaily && (now - userCurrency.lastDaily) < DAILY_COOLDOWN) {
        const nextDaily = new Date(userCurrency.lastDaily.getTime() + DAILY_COOLDOWN);
        if (interaction.deferred || interaction.replied) {
          return await interaction.editReply({
            content: `⏳ Vous avez déjà réclamé votre récompense quotidienne ! Revenez <t:${Math.floor(nextDaily.getTime() / 1000)}:R> pour la prochaine.`,
            embeds: []
          });
        } else {
          return await interaction.reply({
            content: `⏳ Vous avez déjà réclamé votre récompense quotidienne ! Revenez <t:${Math.floor(nextDaily.getTime() / 1000)}:R> pour la prochaine.`,
            ephemeral: true
          });
        }
      }
      
      // Ajouter la récompense
      await userCurrency.addMoney(DAILY_AMOUNT);
      await userCurrency.setDaily();
      
      const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('🎉 Récompense quotidienne !')
        .setDescription(`Vous avez reçu **${DAILY_AMOUNT}** <:coin:1240070496038350919> !`)
        .addFields(
          { name: 'Nouveau solde', value: `${userCurrency.balance} <:coin:1240070496038350919>` },
          { name: 'Prochaine récompense', value: `<t:${Math.floor((Date.now() + DAILY_COOLDOWN) / 1000)}:R>` }
        )
        .setFooter({ text: 'Revenez demain pour une nouvelle récompense !' });
        
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      console.error('Erreur lors de la récupération de la récompense quotidienne :', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ Une erreur est survenue lors de la récupération de votre récompense.',
          embeds: []
        });
      } else {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de la récupération de votre récompense.',
          ephemeral: true
        });
      }
    }
  },
};
