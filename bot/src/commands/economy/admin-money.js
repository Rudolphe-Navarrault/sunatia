const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const Coins = require('../../models/Coins');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-money')
    .setDescription('Gérer l’argent d’un utilisateur (admin only)')
    .addSubcommand((sub) =>
      sub
        .setName('give')
        .setDescription('Donne de l’argent à un utilisateur')
        .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur').setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Montant').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('take')
        .setDescription('Retire de l’argent à un utilisateur')
        .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur').setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Montant').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Remet le solde de l’utilisateur à 0')
        .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Définir le solde exact d’un utilisateur')
        .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur').setRequired(true))
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Montant à définir').setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        content: '❌ Vous n’avez pas la permission d’utiliser cette commande.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Récupérer ou créer le compte
      let user = await Coins.findOrCreate({ userId: target.id, guildId: interaction.guild.id });

      let embed = new EmbedBuilder().setTimestamp();

      if (sub === 'give') {
        const amount = interaction.options.getInteger('amount');
        if (amount <= 0)
          return interaction.editReply({ content: '❌ Le montant doit être supérieur à 0.' });

        user.balance += amount;
        user.totalEarned += amount;
        await user.save();

        embed
          .setColor('#57F287')
          .setTitle('💰 Argent donné')
          .setDescription(
            `${amount.toLocaleString()} pièces ont été ajoutées à ${target.username}.`
          )
          .addFields(
            { name: '💰 Nouveau solde', value: `${user.balance.toLocaleString()} pièces` },
            { name: '✨ Total gagné', value: `${user.totalEarned.toLocaleString()} pièces` }
          );
      } else if (sub === 'take') {
        const amount = interaction.options.getInteger('amount');
        if (amount <= 0)
          return interaction.editReply({ content: '❌ Le montant doit être supérieur à 0.' });

        user.balance = Math.max(0, user.balance - amount);
        await user.save();

        embed
          .setColor('#FF0000')
          .setTitle('💸 Argent retiré')
          .setDescription(
            `${amount.toLocaleString()} pièces ont été retirées à ${target.username}.`
          )
          .addFields({
            name: '💰 Nouveau solde',
            value: `${user.balance.toLocaleString()} pièces`,
          });
      } else if (sub === 'reset') {
        user.balance = 0;
        await user.save();

        embed
          .setColor('#FFA500')
          .setTitle('♻️ Solde réinitialisé')
          .setDescription(`Le solde de ${target.username} a été remis à 0.`)
          .addFields({
            name: '💰 Nouveau solde',
            value: `${user.balance.toLocaleString()} pièces`,
          });
      } else if (sub === 'set') {
        const amount = interaction.options.getInteger('amount');
        if (amount < 0)
          return interaction.editReply({ content: '❌ Le montant doit être positif.' });

        user.balance = amount;
        await user.save();

        embed
          .setColor('#1E90FF')
          .setTitle('🛠️ Solde défini')
          .setDescription(
            `Le solde de ${target.username} a été défini à ${amount.toLocaleString()} pièces.`
          )
          .addFields({
            name: '💰 Nouveau solde',
            value: `${user.balance.toLocaleString()} pièces`,
          });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('❌ Erreur admin-money:', error);
      return interaction.editReply({ content: '❌ Une erreur est survenue.' });
    }
  },
};
