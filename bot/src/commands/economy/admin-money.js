const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Currency = require('../../models/Currency');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-money')
    .setDescription('Gérez l\'argent des utilisateurs (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Ajoute de l\'argent à un utilisateur')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('L\'utilisateur à qui ajouter de l\'argent')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('montant')
            .setDescription('Le montant à ajouter')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option
            .setName('raison')
            .setDescription('Raison de l\'ajout')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Retire de l\'argent à un utilisateur')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('L\'utilisateur à qui retirer de l\'argent')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('montant')
            .setDescription('Le montant à retirer')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option
            .setName('raison')
            .setDescription('Raison du retrait')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Définit le solde d\'un utilisateur')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('L\'utilisateur dont vous voulez définir le solde')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('montant')
            .setDescription('Le nouveau solde')
            .setRequired(true)
            .setMinValue(0)
        )
        .addStringOption(option =>
          option
            .setName('raison')
            .setDescription('Raison de la modification')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('utilisateur');
    const amount = interaction.options.getInteger('montant');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const guildId = interaction.guild.id;

    if (targetUser.bot) {
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply({
          content: '❌ Les bots ne peuvent pas avoir de solde.',
          embeds: []
        });
      } else {
        return await interaction.reply({
          content: '❌ Les bots ne peuvent pas avoir de solde.',
          ephemeral: true
        });
      }
    }

    try {
      const userCurrency = await Currency.getUser(targetUser.id, guildId);
      let newBalance;
      let action;

      switch (subcommand) {
        case 'add':
          await userCurrency.addMoney(amount);
          newBalance = userCurrency.balance;
          action = 'ajouté';
          break;

        case 'remove':
          await userCurrency.removeMoney(amount);
          newBalance = userCurrency.balance;
          action = 'retiré';
          break;

        case 'set':
          userCurrency.balance = amount;
          await userCurrency.save();
          newBalance = amount;
          action = 'défini';
          break;

        default:
          if (interaction.deferred || interaction.replied) {
            return await interaction.editReply({
              content: '❌ Sous-commande non reconnue.',
              embeds: []
            });
          } else {
            return await interaction.reply({
              content: '❌ Sous-commande non reconnue.',
              ephemeral: true
            });
          }
      }

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`✅ Opération réussie`)
        .addFields(
          { name: 'Action', value: `**${action}** ${amount} <:coin:1240070496038350919>` },
          { name: 'Utilisateur', value: `${targetUser.tag} (${targetUser.id})` },
          { name: 'Nouveau solde', value: `${newBalance} <:coin:1240070496038350919>` },
          { name: 'Raison', value: reason }
        )
        .setFooter({ 
          text: `Action effectuée par ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed] });
      }

    } catch (error) {
      console.error(`Erreur lors de l'opération admin-money (${subcommand}):`, error);
      
      const errorMessage = error.message === 'Fonds insuffisants' 
        ? '❌ L\'utilisateur n\'a pas assez d\'argent pour effectuer cette opération.'
        : `❌ Une erreur est survenue lors de l'opération: ${error.message}`;

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
