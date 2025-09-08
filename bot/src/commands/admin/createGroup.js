const { SlashCommandBuilder } = require('discord.js');
const Group = require('../../models/Group'); // On suppose un modèle Group séparé
const { invalidateGroupCache } = require('../../utils/permission');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('creategroup')
    .setDescription('Créer un groupe avec des permissions')
    .addStringOption((option) =>
      option.setName('name').setDescription('Nom du groupe').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('permissions')
        .setDescription('Permissions initiales séparées par des virgules')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    /* if (!(await client.hasPermission(interaction.user.id, 'admin', interaction.guild.id))) {
      return interaction.reply({ content: '❌ Vous n’avez pas la permission', ephemeral: true });
    } */

    const groupName = interaction.options.getString('name');
    const permsInput = interaction.options.getString('permissions');
    const permissions = permsInput ? permsInput.split(',').map((p) => p.trim()) : [];

    // Vérifier si le groupe existe déjà
    const existing = await Group.findOne({ name: groupName, guildId: interaction.guild.id });
    if (existing)
      return interaction.reply({
        content: `❌ Le groupe "${groupName}" existe déjà.`,
        ephemeral: true,
      });

    // Créer le groupe
    const group = new Group({
      name: groupName,
      guildId: interaction.guild.id,
      permissions,
    });
    await group.save();

    invalidateGroupCache(interaction.guild.id, groupName);

    interaction.reply({
      content: `✅ Groupe "${groupName}" créé avec ${permissions.length} permission(s).`,
    });
  },
};
