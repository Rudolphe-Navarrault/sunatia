const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { invalidateUserCache } = require('../../utils/permission');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeperm')
    .setDescription('Retirer une permission à un utilisateur')
    .addUserOption((option) =>
      option.setName('user').setDescription('Utilisateur cible').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('permission').setDescription('Permission à retirer').setRequired(true)
    ),

  async execute(interaction, client) {
    /* if (!(await client.hasPermission(interaction.user.id, 'admin', interaction.guild.id))) {
      return interaction.reply({ content: '❌ Vous n’avez pas la permission', ephemeral: true });
    } */

    const targetUser = interaction.options.getUser('user');
    const permission = interaction.options.getString('permission');

    const user = await User.findOne({ userId: targetUser.id, guildId: interaction.guild.id });
    if (!user || !user.permissions.includes(permission))
      return interaction.reply({
        content: `❌ L'utilisateur n’a pas la permission \`${permission}\``,
        ephemeral: true,
      });

    user.permissions = user.permissions.filter((p) => p !== permission);
    await user.save();
    invalidateUserCache(targetUser.id);

    interaction.reply({
      content: `✅ Permission \`${permission}\` retirée de <@${targetUser.id}>`,
    });
  },
};
