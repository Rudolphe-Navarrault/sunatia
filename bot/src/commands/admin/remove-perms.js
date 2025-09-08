const { SlashCommandBuilder } = require('discord.js');
const CommandPerm = require('../../models/CommandPerm');
const { invalidateCommandCache } = require('../../utils/permission');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-perms')
    .setDescription('Retirer une permission d’une commande')
    .addStringOption((option) =>
      option.setName('commande').setDescription('La commande à modifier').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('permission').setDescription('Permission à retirer').setRequired(true)
    ),

  async execute(interaction) {
    const client = interaction.client;

    // Vérification permission admin
    /* if (!(await client.hasPermission(interaction.user.id, 'admin', interaction.guild.id))) {
      return interaction.reply({ content: '❌ Vous n’avez pas la permission', ephemeral: true });
    } */

    const commandName = interaction.options.getString('commande');
    const permission = interaction.options.getString('permission');

    const cmdPerm = await CommandPerm.findOne({
      guildId: interaction.guild.id,
      command: commandName,
    });
    if (!cmdPerm || !cmdPerm.permissions.includes(permission)) {
      return interaction.reply({
        content: `ℹ️ La permission "${permission}" n’est pas définie pour la commande "${commandName}".`,
        ephemeral: true,
      });
    }

    cmdPerm.permissions = cmdPerm.permissions.filter((p) => p !== permission);
    await cmdPerm.save();
    invalidateCommandCache(interaction.guild.id, commandName);

    return interaction.reply({
      content: `✅ Permission "${permission}" retirée de la commande "${commandName}".`,
      ephemeral: true,
    });
  },
};
