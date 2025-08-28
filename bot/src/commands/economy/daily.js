const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const Coins = require('../../models/Coins'); // ton modèle pour la monnaie

// Config récompense
const MIN_AMOUNT = 1000;
const MAX_AMOUNT = 5000;
const RARE_THRESHOLD = 3000; // au-dessus de 3000, récompense rare
const RARE_CHANCE = 0.2; // 20% de chance d'obtenir une récompense rare

// API pour récupérer l'heure actuelle à Paris
const TIME_API_URL =
  'https://api.ipgeolocation.io/timezone?apiKey=9d152d7e2a4d483a9f65257c793bc53f&tz=Europe/Paris';

async function getParisTime() {
  try {
    const response = await axios.get(TIME_API_URL, { timeout: 3000 });
    const parisTime = new Date(response.data.date_time);
    return parisTime;
  } catch (err) {
    console.warn('⚠️ Impossible de récupérer l’heure via API, fallback UTC serveur.', err.message);
    return new Date(); // fallback UTC du serveur
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Réclame ta récompense quotidienne !'),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch {
      console.warn('⚠️ deferReply échoué (interaction expirée ?) Unknown interaction');
    }

    try {
      const parisTime = await getParisTime();

      // Calculer minuit à Paris pour le cooldown
      const startOfDay = new Date(parisTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(parisTime);
      endOfDay.setHours(23, 59, 59, 999);

      // Récupérer ou créer l'utilisateur
      let user = await Coins.findOne({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });
      if (!user) {
        user = new Coins({
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          balance: 0,
          lastDaily: null,
          totalEarned: 0,
        });
        await user.save();
      }

      // Vérifier si l'utilisateur a déjà réclamé aujourd'hui
      if (user.lastDaily) {
        const lastDaily = new Date(user.lastDaily);
        if (lastDaily >= startOfDay && lastDaily <= endOfDay) {
          const nextDay = new Date(startOfDay);
          nextDay.setDate(nextDay.getDate() + 1);

          const timeLeftMs = nextDay - parisTime;
          const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
          const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

          return interaction.editReply({
            content: `⏳ ${interaction.user.username}, tu as déjà réclamé ton daily ! Reviens demain à minuit (temps restant : ${hours}h ${minutes}m).`,
          });
        }
      }

      // Calculer la récompense
      let reward;
      if (Math.random() < RARE_CHANCE) {
        reward = Math.floor(Math.random() * (MAX_AMOUNT - RARE_THRESHOLD + 1)) + RARE_THRESHOLD;
      } else {
        reward = Math.floor(Math.random() * (RARE_THRESHOLD - MIN_AMOUNT + 1)) + MIN_AMOUNT;
      }

      // Ajouter la récompense et mettre à jour totalEarned
      user.balance += reward;
      user.totalEarned += reward;
      user.lastDaily = parisTime;
      await user.save();

      // Créer l'embed
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🎉 Récompense quotidienne réclamée !')
        .setDescription(`Tu as reçu **${reward.toLocaleString()}** pièces !`)
        .addFields(
          {
            name: '💰 Nouveau solde',
            value: `${user.balance.toLocaleString()} pièces`,
            inline: true,
          },
          {
            name: '✨ Total gagné',
            value: `${user.totalEarned.toLocaleString()} pièces`,
            inline: true,
          },
          { name: '⏳ Prochaine récompense', value: 'Demain à minuit', inline: true }
        )
        .setFooter({ text: 'Reviens demain pour plus de récompenses !' })
        .setTimestamp();

      if (reward >= RARE_THRESHOLD) {
        embed.addFields({
          name: '✨ Récompense rare !',
          value: 'Tu as eu de la chance avec une récompense rare !',
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Erreur daily:', error);
      try {
        return interaction.editReply({
          content: '❌ Une erreur est survenue. Réessaie plus tard.',
        });
      } catch {
        if (interaction.channel)
          interaction.channel.send('❌ Une erreur est survenue avec le daily.');
      }
    }
  },
};
