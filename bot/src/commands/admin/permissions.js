const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const User = require('../../models/User');
const Group = require('../../models/Group');
const CommandPerm = require('../../models/CommandPerm');
const Permission = require('../../models/Permission');
const {
  invalidateUserCache,
  invalidateGroupCache,
  invalidateCommandCache,
  permissionExists,
  userHasPermission,
  groupHasPermission,
} = require('../../utils/permission');

const PER_PAGE = 5;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('permissions')
    .setDescription('Gérer les permissions du serveur')
    // --- USER ---
    .addSubcommandGroup((group) =>
      group
        .setName('user')
        .setDescription('Gérer les permissions des utilisateurs')
        .addSubcommand((sub) =>
          sub
            .setName('set')
            .setDescription('Ajouter une permission à un utilisateur')
            .addUserOption((opt) =>
              opt.setName('utilisateur').setDescription('Utilisateur cible').setRequired(true)
            )
            .addStringOption((opt) =>
              opt.setName('permission').setDescription('Permission existante').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('unset')
            .setDescription('Retirer une permission à un utilisateur')
            .addUserOption((opt) =>
              opt.setName('utilisateur').setDescription('Utilisateur cible').setRequired(true)
            )
            .addStringOption((opt) =>
              opt.setName('permission').setDescription('Permission existante').setRequired(true)
            )
        )
    )
    // --- GROUPS ---
    .addSubcommandGroup((group) =>
      group
        .setName('groups')
        .setDescription('Gérer les permissions des groupes')
        .addSubcommand((sub) =>
          sub
            .setName('set')
            .setDescription('Ajouter une permission à un groupe')
            .addStringOption((opt) =>
              opt.setName('groupe').setDescription('Nom du groupe').setRequired(true)
            )
            .addStringOption((opt) =>
              opt.setName('permission').setDescription('Permission existante').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('unset')
            .setDescription('Retirer une permission à un groupe')
            .addStringOption((opt) =>
              opt.setName('groupe').setDescription('Nom du groupe').setRequired(true)
            )
            .addStringOption((opt) =>
              opt.setName('permission').setDescription('Permission existante').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('create')
            .setDescription('Créer un groupe')
            .addStringOption((opt) =>
              opt.setName('groupe').setDescription('Nom du groupe').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('delete')
            .setDescription('Supprimer un groupe')
            .addStringOption((opt) =>
              opt.setName('groupe').setDescription('Nom du groupe').setRequired(true)
            )
        )
    )
    // --- CREATE / REMOVE PERMISSIONS ---
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Créer une permission')
        .addStringOption((opt) =>
          opt.setName('permission').setDescription('Nom de la permission').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Supprimer une permission')
        .addStringOption((opt) =>
          opt.setName('permission').setDescription('Nom de la permission').setRequired(true)
        )
    )
    // --- LIST ---
    .addSubcommandGroup((group) =>
      group
        .setName('list')
        .setDescription('Lister les permissions')
        .addSubcommand((sub) => sub.setName('all').setDescription('Lister toutes les permissions'))
        .addSubcommand((sub) =>
          sub
            .setName('permission')
            .setDescription('Lister les utilisateurs/groupes ayant une permission')
            .addStringOption((opt) =>
              opt
                .setName('permission')
                .setDescription('Choisissez la permission')
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
    )
    // --- CHECK ---
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Vérifier si un utilisateur/groupe a une permission')
        .addStringOption((opt) =>
          opt.setName('permission').setDescription('Permission à vérifier').setRequired(true)
        )
        .addUserOption((opt) => opt.setName('utilisateur').setDescription('Utilisateur à vérifier'))
        .addStringOption((opt) => opt.setName('groupe').setDescription('Groupe à vérifier'))
    )
    // --- COMMANDS ---
    .addSubcommandGroup((group) =>
      group
        .setName('commands')
        .setDescription('Gérer les permissions des commandes')
        .addSubcommand((sub) =>
          sub
            .setName('set')
            .setDescription('Assigner une permission à une commande')
            .addStringOption((opt) =>
              opt
                .setName('commande')
                .setDescription('Commande cible')
                .setAutocomplete(true)
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt.setName('permission').setDescription('Permission existante').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName('unset')
            .setDescription('Retirer une permission d’une commande')
            .addStringOption((opt) =>
              opt
                .setName('commande')
                .setDescription('Commande cible')
                .setAutocomplete(true)
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt.setName('permission').setDescription('Permission existante').setRequired(true)
            )
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand(false);
    const guildId = interaction.guild.id;

    if (subcommandGroup === 'commands') {
      const choices = Array.from(interaction.client.commands.keys());
      const filtered = focused
        ? choices.filter((c) => c.toLowerCase().startsWith(focused.toLowerCase()))
        : choices;
      await interaction.respond(filtered.slice(0, 25).map((c) => ({ name: c, value: c })));
    }

    if (subcommandGroup === 'list' && subcommand === 'permission') {
      const perms = await Permission.find({ guildId });
      const filtered = focused
        ? perms.filter((p) => p.name.toLowerCase().startsWith(focused.toLowerCase()))
        : perms;
      await interaction.respond(
        filtered.slice(0, 25).map((p) => ({ name: p.name, value: p.name }))
      );
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    const guildId = interaction.guild.id;

    // --- USER ---
    if (group === 'user') {
      const member = interaction.options.getUser('utilisateur');
      const permission = interaction.options.getString('permission')?.toLowerCase();

      if (!(await permissionExists(guildId, permission)))
        return interaction.reply({
          content: `❌ La permission "${permission}" n'existe pas.`,
          ephemeral: true,
        });

      let user = await User.findOne({ guildId, userId: member.id });
      if (!user) user = new User({ guildId, userId: member.id, permissions: [] });

      if (sub === 'set') {
        if (!user.permissions.includes(permission)) user.permissions.push(permission);
        await user.save();
        invalidateUserCache(guildId, member.id);
        return interaction.reply({
          content: `✅ Permission "${permission}" ajoutée à ${member.tag}`,
          ephemeral: true,
        });
      }

      if (sub === 'unset') {
        user.permissions = user.permissions.filter((p) => p !== permission);
        await user.save();
        invalidateUserCache(guildId, member.id);
        return interaction.reply({
          content: `✅ Permission "${permission}" retirée de ${member.tag}`,
          ephemeral: true,
        });
      }
    }

    // --- GROUPS ---
    if (group === 'groups') {
      const groupName = interaction.options.getString('groupe');
      const permission = interaction.options.getString('permission')?.toLowerCase();

      if (['set', 'unset'].includes(sub) && !(await permissionExists(guildId, permission)))
        return interaction.reply({
          content: `❌ La permission "${permission}" n'existe pas.`,
          ephemeral: true,
        });

      if (sub === 'create') {
        const existing = await Group.findOne({
          guildId,
          name: { $regex: `^${groupName}$`, $options: 'i' },
        });
        if (existing)
          return interaction.reply({
            content: `❌ Le groupe "${groupName}" existe déjà.`,
            ephemeral: true,
          });
        await new Group({ guildId, name: groupName, permissions: [] }).save();
        return interaction.reply({ content: `✅ Groupe "${groupName}" créé.`, ephemeral: true });
      }

      if (sub === 'delete') {
        const existing = await Group.findOne({
          guildId,
          name: { $regex: `^${groupName}$`, $options: 'i' },
        });
        if (!existing)
          return interaction.reply({
            content: `❌ Le groupe "${groupName}" n’existe pas.`,
            ephemeral: true,
          });
        await Group.deleteOne({ guildId, name: existing.name });
        return interaction.reply({
          content: `✅ Groupe "${existing.name}" supprimé.`,
          ephemeral: true,
        });
      }

      let groupDoc = await Group.findOne({
        guildId,
        name: { $regex: `^${groupName}$`, $options: 'i' },
      });
      if (!groupDoc && ['set', 'unset'].includes(sub))
        return interaction.reply({
          content: `❌ Groupe "${groupName}" introuvable.`,
          ephemeral: true,
        });

      if (sub === 'set') {
        if (!groupDoc.permissions.includes(permission)) groupDoc.permissions.push(permission);
        await groupDoc.save();
        invalidateGroupCache(guildId, groupDoc.name);
        return interaction.reply({
          content: `✅ Permission "${permission}" ajoutée au groupe "${groupDoc.name}"`,
          ephemeral: true,
        });
      }

      if (sub === 'unset') {
        groupDoc.permissions = groupDoc.permissions.filter((p) => p !== permission);
        await groupDoc.save();
        invalidateGroupCache(guildId, groupDoc.name);
        return interaction.reply({
          content: `✅ Permission "${permission}" retirée du groupe "${groupDoc.name}"`,
          ephemeral: true,
        });
      }
    }

    // --- CREATE / REMOVE PERMISSIONS ---
    if (sub === 'create') {
      const permission = interaction.options.getString('permission')?.toLowerCase();
      if (await permissionExists(guildId, permission))
        return interaction.reply({
          content: `❌ La permission "${permission}" existe déjà.`,
          ephemeral: true,
        });
      await new Permission({ guildId, name: permission }).save();
      return interaction.reply({
        content: `✅ Permission "${permission}" créée.`,
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const permission = interaction.options.getString('permission')?.toLowerCase();
      if (!(await permissionExists(guildId, permission)))
        return interaction.reply({
          content: `❌ La permission "${permission}" n'existe pas.`,
          ephemeral: true,
        });

      await User.updateMany({ guildId }, { $pull: { permissions: permission } });
      await Group.updateMany({ guildId }, { $pull: { permissions: permission } });
      await CommandPerm.updateMany({ guildId }, { $pull: { permissions: permission } });
      await Permission.deleteOne({ guildId, name: permission });

      return interaction.reply({
        content: `✅ Permission "${permission}" supprimée partout.`,
        ephemeral: true,
      });
    }

    // --- LIST ---
    if (group === 'list') {
      let items = [];
      if (sub === 'all') {
        const allPerms = await Permission.find({ guildId });
        items = allPerms.map((p) => p.name);

        const users = await User.find({ guildId });
        const groups = await Group.find({ guildId });

        users.forEach((u) => u.permissions.forEach((p) => items.push(p)));
        groups.forEach((g) => g.permissions.forEach((p) => items.push(p)));

        items = [...new Set(items)];
      }

      if (sub === 'permission') {
        const permissionName = interaction.options.getString('permission')?.toLowerCase();
        if (!(await permissionExists(guildId, permissionName)))
          return interaction.reply({
            content: `❌ La permission "${permissionName}" n'existe pas.`,
            ephemeral: true,
          });

        const users = await User.find({ guildId, permissions: permissionName });
        const groups = await Group.find({ guildId, permissions: permissionName });

        items = [
          `**Utilisateurs:** ${users.map((u) => `<@${u.userId}>`).join(', ') || 'Aucun'}`,
          `**Groupes:** ${groups.map((g) => g.name).join(', ') || 'Aucun'}`,
        ];
      }

      if (!items.length)
        return interaction.reply({ content: 'ℹ️ Aucune permission trouvée.', ephemeral: true });

      const page = 1;
      const totalPages = Math.ceil(items.length / PER_PAGE);
      const embed = new EmbedBuilder()
        .setTitle(`📋 Permissions`)
        .setColor('#00bfff')
        .setDescription(items.slice(0, PER_PAGE).join('\n'))
        .setFooter({ text: `Page ${page}/${totalPages}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`perm_prev_1_1`)
          .setLabel('⬅️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`perm_next_1_1`)
          .setLabel('➡️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(totalPages <= 1)
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      interaction.client.permissionPages.set('1', {
        items,
        currentPage: 1,
        totalPages,
        embed,
        row,
      });
    }

    // --- CHECK ---
    if (sub === 'check') {
      const permission = interaction.options.getString('permission')?.toLowerCase();
      const user = interaction.options.getUser('utilisateur');
      const groupName = interaction.options.getString('groupe');

      if (!(await permissionExists(guildId, permission)))
        return interaction.reply({
          content: `❌ La permission "${permission}" n'existe pas.`,
          ephemeral: true,
        });

      if (user) {
        const has = await userHasPermission(guildId, user.id, permission);
        return interaction.reply({
          content: has
            ? `✅ ${user.tag} a "${permission}"`
            : `❌ ${user.tag} n’a pas "${permission}"`,
          ephemeral: true,
        });
      }

      if (groupName) {
        const groupDoc = await Group.findOne({
          guildId,
          name: { $regex: `^${groupName}$`, $options: 'i' },
        });
        if (!groupDoc)
          return interaction.reply({
            content: `❌ Le groupe "${groupName}" n’existe pas.`,
            ephemeral: true,
          });

        const has = await groupHasPermission(guildId, groupDoc.name, permission);
        return interaction.reply({
          content: has
            ? `✅ Le groupe "${groupDoc.name}" a "${permission}"`
            : `❌ Le groupe "${groupDoc.name}" n’a pas "${permission}"`,
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: '❌ Fournissez un utilisateur ou un groupe.',
        ephemeral: true,
      });
    }

    // --- COMMANDS ---
    if (group === 'commands') {
      const command = interaction.options.getString('commande');
      const permission = interaction.options.getString('permission')?.toLowerCase();

      if (!(await permissionExists(guildId, permission)))
        return interaction.reply({
          content: `❌ La permission "${permission}" n'existe pas.`,
          ephemeral: true,
        });

      let cmdPerm = await CommandPerm.findOne({ guildId, command });

      if (sub === 'set') {
        if (!cmdPerm) cmdPerm = new CommandPerm({ guildId, command, permissions: [permission] });
        else if (!cmdPerm.permissions.includes(permission)) cmdPerm.permissions.push(permission);

        await cmdPerm.save();
        invalidateCommandCache(guildId, command);
        return interaction.reply({
          content: `✅ Permission "${permission}" ajoutée à la commande "${command}".`,
          ephemeral: true,
        });
      }

      if (sub === 'unset') {
        if (!cmdPerm || !cmdPerm.permissions.includes(permission))
          return interaction.reply({
            content: `ℹ️ La commande "${command}" n’a pas la permission "${permission}".`,
            ephemeral: true,
          });

        cmdPerm.permissions = cmdPerm.permissions.filter((p) => p !== permission);
        await cmdPerm.save();
        invalidateCommandCache(guildId, command);
        return interaction.reply({
          content: `✅ Permission "${permission}" retirée de la commande "${command}".`,
          ephemeral: true,
        });
      }
    }
  },
};
