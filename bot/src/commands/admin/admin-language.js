const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Language = require('../../models/Language');
const {
  getLang,
  setUserLang,
  setServerLang,
  getServerLangs,
  setServerLangs,
  getDefaultLang,
  setDefaultLang,
} = require('../../utils/language');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-language')
    .setDescription('Commande avancée de gestion des langues (administrateurs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)

    // --- RESET ---
    .addSubcommandGroup((group) =>
      group
        .setName('reset')
        .setDescription('Réinitialiser la langue')
        .addSubcommand((sub) =>
          sub
            .setName('user')
            .setDescription('Réinitialiser la langue d’un utilisateur')
            .addUserOption((opt) =>
              opt.setName('user').setDescription('Utilisateur cible').setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub.setName('server').setDescription('Réinitialiser la langue du serveur')
        )
    )

    // --- COPY ---
    .addSubcommand((sub) =>
      sub
        .setName('copy')
        .setDescription('Copier la langue d’un utilisateur vers un autre')
        .addUserOption((opt) =>
          opt.setName('source').setDescription('Utilisateur source').setRequired(true)
        )
        .addUserOption((opt) =>
          opt.setName('target').setDescription('Utilisateur cible').setRequired(false)
        )
    )

    // --- INFO / AUDIT ---
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Voir les informations de langue d’un utilisateur')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur cible').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('audit').setDescription('Lister tous les utilisateurs avec langue personnalisée')
    )

    // --- LANGUES DISPONIBLES ---
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Ajouter une langue disponible pour ce serveur')
        .addStringOption((opt) =>
          opt.setName('langue').setDescription('Langue à ajouter').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Supprimer une langue disponible pour ce serveur')
        .addStringOption((opt) =>
          opt.setName('langue').setDescription('Langue à supprimer').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('default')
        .setDescription('Changer la langue par défaut du serveur')
        .addStringOption((opt) =>
          opt.setName('langue').setDescription('Nouvelle langue par défaut').setRequired(true)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const guildId = interaction.guild.id;

    const langs = await getServerLangs(guildId);
    const filtered = focused
      ? langs.filter((l) => l.toLowerCase().startsWith(focused.toLowerCase()))
      : langs;

    await interaction.respond(filtered.slice(0, 25).map((l) => ({ name: l, value: l })));
  },

  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
      // --- RESET ---
      if (group === 'reset') {
        if (sub === 'user') {
          const user = interaction.options.getUser('user');
          await setUserLang(guildId, user.id, null);
          return interaction.reply({
            content: `✅ La langue de **${user.tag}** a été réinitialisée à la langue du serveur`,
            ephemeral: true,
          });
        }
        if (sub === 'server') {
          await setServerLang(guildId, null);
          const defaultLang = await getLang(guildId, null); // récupère la langue effective
          return interaction.reply({
            content: `✅ La langue du serveur a été réinitialisée à **${defaultLang}**`,
            ephemeral: true,
          });
        }
      }

      // --- COPY ---
      if (sub === 'copy') {
        const source = interaction.options.getUser('source');
        const target = interaction.options.getUser('target') || interaction.user;
        const lang = await getLang(guildId, source.id);
        await setUserLang(guildId, target.id, lang);
        return interaction.reply({
          content: `✅ La langue de **${source.tag}** a été copiée vers **${target.tag}**`,
          ephemeral: false,
        });
      }

      // --- INFO / AUDIT ---
      if (sub === 'info') {
        const user = interaction.options.getUser('user') || interaction.user;
        const lang = await getLang(guildId, user.id);
        const record = await Language.findOne({ guildId, userId: user.id });
        const updatedAt = record?.updatedAt ? record.updatedAt.toLocaleString() : 'N/A';
        const isServer = record?.userId === null;

        return interaction.reply({
          content: `🌐 Info de langue pour **${user.tag}** :\nLangue : **${lang}**\nMise à jour : ${updatedAt}\nType : ${isServer ? 'Serveur' : 'Utilisateur'}`,
          ephemeral: true,
        });
      }

      if (sub === 'audit') {
        const records = await Language.find({ guildId, userId: { $ne: null } });
        if (!records.length)
          return interaction.reply({
            content: 'Aucun utilisateur avec langue personnalisée.',
            ephemeral: true,
          });
        const list = records.map((r) => `<@${r.userId}> : ${r.lang}`).join('\n');
        return interaction.reply({
          content: `📝 Utilisateurs avec langue personnalisée :\n${list}`,
          ephemeral: true,
        });
      }

      // --- LANGUES DISPONIBLES ---
      if (sub === 'add') {
        const lang = interaction.options.getString('langue');
        const langs = await getServerLangs(guildId);
        if (langs.includes(lang))
          return interaction.reply({
            content: `❌ La langue ${lang} existe déjà pour ce serveur.`,
            ephemeral: true,
          });
        langs.push(lang);
        await setServerLangs(guildId, langs);
        return interaction.reply({
          content: `✅ Langue **${lang}** ajoutée pour ce serveur.`,
          ephemeral: false,
        });
      }

      if (sub === 'remove') {
        const lang = interaction.options.getString('langue');
        let langs = await getServerLangs(guildId);
        if (!langs.includes(lang))
          return interaction.reply({
            content: `❌ La langue ${lang} n’existe pas pour ce serveur.`,
            ephemeral: true,
          });
        langs = langs.filter((l) => l !== lang);
        await setServerLangs(guildId, langs);
        return interaction.reply({
          content: `✅ Langue **${lang}** supprimée pour ce serveur.`,
          ephemeral: false,
        });
      }

      if (sub === 'default') {
        const lang = interaction.options.getString('langue');
        const langs = await getServerLangs(guildId);
        if (!langs.includes(lang))
          return interaction.reply({
            content: `❌ Langue inconnue pour ce serveur : ${lang}`,
            ephemeral: true,
          });
        await setDefaultLang(guildId, lang);
        return interaction.reply({
          content: `✅ Langue par défaut changée à **${lang}** pour ce serveur.`,
          ephemeral: false,
        });
      }
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
    }
  },
};
