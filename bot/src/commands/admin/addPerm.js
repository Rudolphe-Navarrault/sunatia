const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const Group = require('../../models/Group');
const { invalidateUserCache, invalidateGroupCache } = require('../../utils/permission');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addperm')
    .setDescription('Ajouter des permissions à un utilisateur ou un groupe')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Type de cible')
        .setRequired(true)
        .addChoices({ name: 'Utilisateur', value: 'user' }, { name: 'Groupe', value: 'group' })
    )
    .addStringOption((option) =>
      option
        .setName('permissions')
        .setDescription('Liste de permissions séparées par des virgules')
        .setRequired(true)
    )
    .addUserOption((option) =>
      option.setName('utilisateur').setDescription("L'utilisateur à qui ajouter les permissions")
    )
    .addStringOption((option) => option.setName('groupe').setDescription('Le nom du groupe')),

  async execute(interaction) {
    const client = interaction.client;

    // Vérification permission admin
    /* if (!(await client.hasPermission(interaction.user.id, 'admin', interaction.guild.id))) {
      return interaction.reply({ content: '❌ Vous n’avez pas la permission', ephemeral: true });
    } */

    const type = interaction.options.getString('type');
    const permsInput = interaction.options.getString('permissions');
    const newPerms = permsInput
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p);

    if (!newPerms.length) {
      return interaction.reply({
        content: '❌ Veuillez fournir au moins une permission.',
        ephemeral: true,
      });
    }

    if (type === 'user') {
      const member = interaction.options.getUser('utilisateur');
      if (!member) {
        return interaction.reply({
          content: '❌ Veuillez spécifier un utilisateur.',
          ephemeral: true,
        });
      }

      // Récupérer ou créer l'utilisateur
      let user = await User.findOne({ userId: member.id, guildId: interaction.guild.id });
      if (!user) {
        user = new User({
          userId: member.id,
          guildId: interaction.guild.id,
          username: member.username,
          discriminator: member.discriminator,
          groups: [],
          permissions: [],
        });
      }

      // Ajouter les permissions (sans doublons)
      const added = [];
      for (const perm of newPerms) {
        if (!user.permissions.includes(perm)) {
          user.permissions.push(perm);
          added.push(perm);
        }
      }

      await user.save();
      invalidateUserCache(interaction.guild.id, member.id);

      return interaction.reply({
        content: added.length
          ? `✅ Permissions ajoutées à <@${member.id}> : ${added.join(', ')}`
          : 'ℹ️ Aucune permission à ajouter, toutes étaient déjà présentes.',
        ephemeral: true,
      });
    } else if (type === 'group') {
      const groupName = interaction.options.getString('groupe');
      if (!groupName) {
        return interaction.reply({ content: '❌ Veuillez spécifier un groupe.', ephemeral: true });
      }

      const group = await Group.findOne({ name: groupName, guildId: interaction.guild.id });
      if (!group) {
        return interaction.reply({
          content: `❌ Le groupe "${groupName}" n'existe pas.`,
          ephemeral: true,
        });
      }

      const added = [];
      for (const perm of newPerms) {
        if (!group.permissions.includes(perm)) {
          group.permissions.push(perm);
          added.push(perm);
        }
      }

      await group.save();
      invalidateGroupCache(interaction.guild.id, groupName);

      return interaction.reply({
        content: added.length
          ? `✅ Permissions ajoutées au groupe "${groupName}": ${added.join(', ')}`
          : 'ℹ️ Aucune permission à ajouter, toutes étaient déjà présentes.',
        ephemeral: true,
      });
    } else {
      return interaction.reply({ content: '❌ Type invalide.', ephemeral: true });
    }
  },
};
