const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { invalidateUserCache } = require('../../utils/permission');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removegroup')
    .setDescription('Retirer un groupe d’un utilisateur')
    .addUserOption((option) =>
      option.setName('user').setDescription('Utilisateur du groupe').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('group').setDescription('Nom du groupe à retirer').setRequired(true)
    ),

  async execute(interaction, client) {
    /* if (!(await client.hasPermission(interaction.user.id, 'admin', interaction.guild.id))) {
      return interaction.reply({ content: '❌ Vous n’avez pas la permission', ephemeral: true });
    } */

    const targetUser = interaction.options.getUser('user');
    const groupName = interaction.options.getString('group');

    const user = await User.findOne({ userId: targetUser.id, guildId: interaction.guild.id });
    if (!user || !user.groups.includes(groupName))
      return interaction.reply({
        content: `❌ L'utilisateur n’est pas dans le groupe ${groupName}`,
        ephemeral: true,
      });

    user.groups = user.groups.filter((g) => g !== groupName);
    await user.save();
    invalidateUserCache(targetUser.id);

    interaction.reply({ content: `✅ Groupe ${groupName} retiré de <@${targetUser.id}>` });
  },
};
