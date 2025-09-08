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

    // USER
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

    // GROUPS
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

    // CREATE / REMOVE PERMISSIONS
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

    // LIST
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Lister les permissions')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('All ou Permission')
            .setRequired(true)
            .addChoices({ name: 'All', value: 'all' }, { name: 'Permission', value: 'permission' })
        )
        .addStringOption((opt) =>
          opt
            .setName('permission')
            .setDescription('Choisissez la permission spécifique')
            .setAutocomplete(true)
            .setRequired(false)
        )
    )

    // CHECK
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

    // COMMANDS
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
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    // Autocomplete commandes
    if (group === 'commands') {
      const choices = Array.from(interaction.client.commands.keys());
      const filtered = focused
        ? choices.filter((c) => c.toLowerCase().startsWith(focused.toLowerCase()))
        : choices;
      await interaction.respond(filtered.slice(0, 25).map((c) => ({ name: c, value: c })));
    }

    // Autocomplete permissions pour /permissions list type=permission
    if (sub === 'list') {
      const type = interaction.options.getString('type');
      if (type === 'permission') {
        const perms = await Permission.find({ guildId: interaction.guild.id });
        const filtered = focused
          ? perms.filter((p) => p.name.toLowerCase().startsWith(focused.toLowerCase()))
          : perms;
        await interaction.respond(
          filtered.slice(0, 25).map((p) => ({ name: p.name, value: p.name }))
        );
      } else {
        await interaction.respond([]); // All = rien à compléter
      }
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    // --- USER ---
    if (group === 'user') {
      const member = interaction.options.getUser('utilisateur');
      const permission = interaction.options.getString('permission')?.toLowerCase();
      if (!(await permissionExists(interaction.guild.id, permission)))
        return interaction.reply({
          content: `❌ La permission "${permission}" n'existe pas.`,
          ephemeral: true,
        });

      let user = await User.findOne({ guildId: interaction.guild.id, userId: member.id });
      if (!user)
        user = new User({ guildId: interaction.guild.id, userId: member.id, permissions: [] });

      if (sub === 'set') {
        if (!user.permissions.map((p) => p.toLowerCase()).includes(permission))
          user.permissions.push(permission);
        await user.save();
        invalidateUserCache(interaction.guild.id, member.id);
        return interaction.reply({
          content: `✅ Permission "${permission}" ajoutée à ${member.tag}`,
          ephemeral: true,
        });
      }

      if (sub === 'unset') {
        user.permissions = user.permissions.filter((p) => p.toLowerCase() !== permission);
        await user.save();
        invalidateUserCache(interaction.guild.id, member.id);
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

      if (
        ['set', 'unset'].includes(sub) &&
        !(await permissionExists(interaction.guild.id, permission))
      )
        return interaction.reply({
          content: `❌ La permission "${permission}" n'existe pas.`,
          ephemeral: true,
        });

      if (sub === 'create') {
        const existing = await Group.findOne({
          guildId: interaction.guild.id,
          name: { $regex: `^${groupName}$`, $options: 'i' },
        });
        if (existing)
          return interaction.reply({
            content: `❌ Le groupe "${groupName}" existe déjà.`,
            ephemeral: true,
          });
        await new Group({ guildId: interaction.guild.id, name: groupName, permissions: [] }).save();
        return interaction.reply({ content: `✅ Groupe "${groupName}" créé.`, ephemeral: true });
      }

      if (sub === 'delete') {
        const existing = await Group.findOne({
          guildId: interaction.guild.id,
          name: { $regex: `^${groupName}$`, $options: 'i' },
        });
        if (!existing)
          return interaction.reply({
            content: `❌ Le groupe "${groupName}" n’existe pas.`,
            ephemeral: true,
          });
        await Group.deleteOne({ guildId: interaction.guild.id, name: existing.name });
        return interaction.reply({
          content: `✅ Groupe "${existing.name}" supprimé.`,
          ephemeral: true,
        });
      }

      let groupDoc = await Group.findOne({
        guildId: interaction.guild.id,
        name: { $regex: `^${groupName}$`, $options: 'i' },
      });
      if (!groupDoc && ['set', 'unset'].includes(sub))
        return interaction.reply({
          content: `❌ Groupe "${groupName}" introuvable.`,
          ephemeral: true,
        });

      if (sub === 'set') {
        if (!groupDoc.permissions.map((p) => p.toLowerCase()).includes(permission))
          groupDoc.permissions.push(permission);
        await groupDoc.save();
        invalidateGroupCache(interaction.guild.id, groupDoc.name);
        return interaction.reply({
          content: `✅ Permission "${permission}" ajoutée au groupe "${groupDoc.name}"`,
          ephemeral: true,
        });
      }

      if (sub === 'unset') {
        groupDoc.permissions = groupDoc.permissions.filter((p) => p.toLowerCase() !== permission);
        await groupDoc.save();
        invalidateGroupCache(interaction.guild.id, groupDoc.name);
        return interaction.reply({
          content: `✅ Permission "${permission}" retirée du groupe "${groupDoc.name}"`,
          ephemeral: true,
        });
      }
    }

    // --- CREATE / REMOVE PERMISSIONS ---
    if (sub === 'create') {
      const permission = interaction.options.getString('permission')?.toLowerCase();
      if (await permissionExists(interaction.guild.id, permission))
        return interaction.reply({
          content: `❌ La permission "${permission}" existe déjà.`,
          ephemeral: true,
        });
      await new Permission({ guildId: interaction.guild.id, name: permission }).save();
      return interaction.reply({
        content: `✅ Permission "${permission}" créée.`,
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const permission = interaction.options.getString('permission')?.toLowerCase();
      if (!(await permissionExists(interaction.guild.id, permission)))
        return interaction.reply({
          content: `❌ La permission "${permission}" n'existe pas.`,
          ephemeral: true,
        });
      await User.updateMany(
        { guildId: interaction.guild.id },
        { $pull: { permissions: permission } }
      );
      await Group.updateMany(
        { guildId: interaction.guild.id },
        { $pull: { permissions: permission } }
      );
      await CommandPerm.updateMany(
        { guildId: interaction.guild.id },
        { $pull: { permissions: permission } }
      );
      await Permission.deleteOne({ guildId: interaction.guild.id, name: permission });
      return interaction.reply({
        content: `✅ Permission "${permission}" supprimée partout.`,
        ephemeral: true,
      });
    }

    // --- LIST ---
    if (sub === 'list') {
      const type = interaction.options.getString('type');
      let items = [];

      if (type === 'all') {
        const perms = await Permission.find({ guildId: interaction.guild.id });
        items = perms.map((p) => p.name);
      } else {
        const permission = interaction.options.getString('permission')?.toLowerCase();
        if (!(await permissionExists(interaction.guild.id, permission)))
          return interaction.reply({
            content: `❌ La permission "${permission}" n'existe pas.`,
            ephemeral: true,
          });

        const users = await User.find({ guildId: interaction.guild.id, permissions: permission });
        const groups = await Group.find({ guildId: interaction.guild.id, permissions: permission });

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
        .setTitle('📋 Permissions')
        .setColor('#00bfff')
        .setDescription(items.slice(0, PER_PAGE).join('\n'))
        .setFooter({ text: `Page ${page}/${totalPages}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`perm_prev_1`)
          .setLabel('⬅️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`perm_next_1`)
          .setLabel('➡️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(totalPages <= 1)
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      interaction.client.permissionPages = interaction.client.permissionPages || new Map();
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

      if (!(await permissionExists(interaction.guild.id, permission)))
        return interaction.reply({
          content: `❌ La permission "${permission}" n'existe pas.`,
          ephemeral: true,
        });

      if (user) {
        const has = await userHasPermission(interaction.guild.id, user.id, permission);
        return interaction.reply({
          content: has
            ? `✅ ${user.tag} a "${permission}"`
            : `❌ ${user.tag} n’a pas "${permission}"`,
          ephemeral: true,
        });
      }

      if (groupName) {
        const groupDoc = await Group.findOne({
          guildId: interaction.guild.id,
          name: { $regex: `^${groupName}$`, $options: 'i' },
        });
        if (!groupDoc)
          return interaction.reply({
            content: `❌ Le groupe "${groupName}" n’existe pas.`,
            ephemeral: true,
          });
        const has = await groupHasPermission(interaction.guild.id, groupDoc.name, permission);
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
      if (!(await permissionExists(interaction.guild.id, permission)))
        return interaction.reply({
          content: `❌ La permission "${permission}" n'existe pas.`,
          ephemeral: true,
        });

      let cmdPerm = await CommandPerm.findOne({ guildId: interaction.guild.id, command });

      if (sub === 'set') {
        if (!cmdPerm)
          cmdPerm = new CommandPerm({
            guildId: interaction.guild.id,
            command,
            permissions: [permission],
          });
        else if (!cmdPerm.permissions.map((p) => p.toLowerCase()).includes(permission))
          cmdPerm.permissions.push(permission);
        await cmdPerm.save();
        invalidateCommandCache(interaction.guild.id, command);
        return interaction.reply({
          content: `✅ Permission "${permission}" ajoutée à la commande "${command}".`,
          ephemeral: true,
        });
      }

      if (sub === 'unset') {
        if (!cmdPerm || !cmdPerm.permissions.map((p) => p.toLowerCase()).includes(permission))
          return interaction.reply({
            content: `ℹ️ La commande "${command}" n’a pas la permission "${permission}".`,
            ephemeral: true,
          });
        cmdPerm.permissions = cmdPerm.permissions.filter((p) => p.toLowerCase() !== permission);
        await cmdPerm.save();
        invalidateCommandCache(interaction.guild.id, command);
        return interaction.reply({
          content: `✅ Permission "${permission}" retirée de la commande "${command}".`,
          ephemeral: true,
        });
      }
    }
  },
};
