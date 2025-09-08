const { SlashCommandBuilder } = require('discord.js');
const CommandPerm = require('../../models/CommandPerm');
const { invalidateCommandCache } = require('../../utils/permission');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-perms')
    .setDescription('Ajouter une permission à une commande')
    .addStringOption((option) =>
      option.setName('commande').setDescription('La commande à protéger').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('permission').setDescription('Permission à ajouter').setRequired(true)
    ),

  async execute(interaction) {
    const client = interaction.client;

    // Vérification permission admin
    /* if (!(await client.hasPermission(interaction.user.id, 'admin', interaction.guild.id))) {
      return interaction.reply({ content: '❌ Vous n’avez pas la permission', ephemeral: true });
    } */

    const commandName = interaction.options.getString('commande');
    const permission = interaction.options.getString('permission');

    let cmdPerm = await CommandPerm.findOne({
      guildId: interaction.guild.id,
      command: commandName,
    });
    if (!cmdPerm) {
      cmdPerm = new CommandPerm({
        guildId: interaction.guild.id,
        command: commandName,
        permissions: [permission],
      });
    } else {
      if (!cmdPerm.permissions.includes(permission)) cmdPerm.permissions.push(permission);
    }

    await cmdPerm.save();
    invalidateCommandCache(interaction.guild.id, commandName);

    return interaction.reply({
      content: `✅ Permission "${permission}" ajoutée à la commande "${commandName}".`,
      ephemeral: true,
    });
  },
};
