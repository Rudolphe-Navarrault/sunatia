const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Currency = require('../../models/Currency');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Envoyer de l\'argent à un autre utilisateur')
    .addUserOption(option =>
      option
        .setName('utilisateur')
        .setDescription('L\'utilisateur à qui envoyer de l\'argent')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('montant')
        .setDescription('Le montant à envoyer')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('utilisateur');
    const amount = interaction.options.getInteger('montant');
    const guildId = interaction.guild.id;

    // Vérifications de base
    if (targetUser.bot) {
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply({
          content: '❌ Vous ne pouvez pas envoyer d\'argent à un bot.',
          embeds: []
        });
      } else {
        return await interaction.reply({
          content: '❌ Vous ne pouvez pas envoyer d\'argent à un bot.',
          ephemeral: true
        });
      }
    }

    if (targetUser.id === interaction.user.id) {
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply({
          content: '❌ Vous ne pouvez pas vous envoyer de l\'argent à vous-même.',
          embeds: []
        });
      } else {
        return await interaction.reply({
          content: '❌ Vous ne pouvez pas vous envoyer de l\'argent à vous-même.',
          ephemeral: true
        });
      }
    }

    try {
      // Récupérer les soldes des deux utilisateurs
      const [sender, receiver] = await Promise.all([
        Currency.getUser(interaction.user.id, guildId),
        Currency.getUser(targetUser.id, guildId)
      ]);

      // Vérifier que l'expéditeur a assez d'argent
      if (sender.balance < amount) {
        if (interaction.deferred || interaction.replied) {
          return await interaction.editReply({
            content: `❌ Vous n'avez pas assez d'argent pour effectuer ce virement. Solde actuel: ${sender.balance} <:coin:1240070496038350919>`,
            embeds: []
          });
        } else {
          return await interaction.reply({
            content: `❌ Vous n'avez pas assez d'argent pour effectuer ce virement. Solde actuel: ${sender.balance} <:coin:1240070496038350919>`,
            ephemeral: true
          });
        }
      }

      // Effectuer le transfert
      await sender.transferMoney(receiver, amount);

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('💸 Virement effectué !')
        .setDescription(`Vous avez envoyé **${amount}** <:coin:1240070496038350919> à ${targetUser.tag}`)
        .addFields(
          { name: 'Votre nouveau solde', value: `${sender.balance} <:coin:1240070496038350919>`, inline: true },
          { name: 'Leur nouveau solde', value: `${receiver.balance} <:coin:1240070496038350919>`, inline: true }
        )
        .setFooter({ text: `Transaction effectuée par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed] });
      }

      // Envoyer un message privé au destinataire si possible
      try {
        await targetUser.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#2ecc71')
              .setTitle('💸 Vous avez reçu de l\'argent !')
              .setDescription(`Vous avez reçu **${amount}** <:coin:1240070496038350919> de ${interaction.user.tag}`)
              .addFields([
                { name: 'Nouveau solde', value: `${receiver.balance} <:coin:1240070496038350919>` }
              ])
              .setTimestamp()
          ]
        });
      } catch (error) {
        console.error(`Impossible d'envoyer un message à ${targetUser.tag}:`, error);
      }

    } catch (error) {
      console.error('Erreur lors du virement :', error);
      
      const errorMessage = error.message === 'Fonds insuffisants' 
        ? '❌ Vous n\'avez pas assez d\'argent pour effectuer ce virement.'
        : '❌ Une erreur est survenue lors du virement.';

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: errorMessage,
          embeds: []
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true
        });
      }
    }
  },
};
