const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Currency = require('../../models/Currency');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Affiche le solde d\'un utilisateur')
    .addUserOption(option =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur dont vous voulez voir le solde')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
      const guildId = interaction.guild.id;

      if (targetUser.bot) {
        return interaction.reply({
          content: '❌ Les bots ne peuvent pas avoir de solde.',
          ephemeral: true
        });
      }

      const userCurrency = await Currency.getUser(targetUser.id, guildId);
      
      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`💰 Solde de ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: 'Solde actuel', value: `${userCurrency.balance} <:coin:1240070496038350919>`, inline: true },
          { name: 'Dernière récompense quotidienne', 
            value: userCurrency.lastDaily 
              ? `<t:${Math.floor(userCurrency.lastDaily.getTime() / 1000)}:R>` 
              : 'Jamais',
            inline: true 
          }
        )
        .setFooter({ text: `Demandé par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      // Vérifier si l'interaction a déjà été répondue
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply({ embeds: [embed] });
      } else {
        return await interaction.reply({ embeds: [embed] });
      }

    } catch (error) {
      console.error('Erreur lors de la récupération du solde :', error);
      
      // Vérifier si l'interaction a déjà été répondue
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply({
          content: '❌ Une erreur est survenue lors de la récupération du solde.',
          ephemeral: true
        });
      } else {
        return await interaction.reply({
          content: '❌ Une erreur est survenue lors de la récupération du solde.',
          ephemeral: true
        });
      }
    }
  },
};
