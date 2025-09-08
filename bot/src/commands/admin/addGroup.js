const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { invalidateUserCache } = require('../../utils/permission');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addgroup')
    .setDescription('Ajouter un groupe à un utilisateur')
    .addUserOption((option) =>
      option.setName('user').setDescription('Utilisateur à qui ajouter le groupe').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('group').setDescription('Nom du groupe').setRequired(true)
    ),

  async execute(interaction, client) {
    /* if (!(await client.hasPermission(interaction.user.id, 'admin', interaction.guild.id))) {
      return interaction.reply({ content: '❌ Vous n’avez pas la permission', ephemeral: true });
    } */

    const targetUser = interaction.options.getUser('user');
    const groupName = interaction.options.getString('group');

    let user = await User.findOne({ userId: targetUser.id, guildId: interaction.guild.id });
    if (!user) {
      user = new User({
        userId: targetUser.id,
        username: targetUser.username,
        discriminator: targetUser.discriminator,
        guildId: interaction.guild.id,
      });
    }

    if (!user.groups.includes(groupName)) {
      user.groups.push(groupName);
      await user.save();
      invalidateUserCache(targetUser.id);
    }

    interaction.reply({ content: `✅ Groupe ${groupName} ajouté à <@${targetUser.id}>` });
  },
};
