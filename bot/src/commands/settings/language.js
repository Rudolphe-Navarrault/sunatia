const { SlashCommandBuilder } = require('discord.js');
const { getLang, setUserLang, setServerLang, getServerLangs } = require('../../utils/language');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('language')
    .setDescription('Gérer la langue du serveur ou de votre langue personnelle')

    // --- Set sa propre langue ---
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Changer votre langue personnelle')
        .addStringOption((opt) =>
          opt
            .setName('langue')
            .setDescription('Choisissez la langue')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )

    // --- Get sa langue ou celle d’un autre utilisateur ---
    .addSubcommand((sub) =>
      sub
        .setName('get')
        .setDescription('Voir votre langue ou celle d’un utilisateur')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Utilisateur cible').setRequired(false)
        )
    )

    // --- Server set/get ---
    .addSubcommand((sub) =>
      sub
        .setName('server-set')
        .setDescription('Changer la langue du serveur')
        .addStringOption((opt) =>
          opt
            .setName('langue')
            .setDescription('Choisissez la langue')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) => sub.setName('server-get').setDescription('Voir la langue du serveur'))

    // --- List ---
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Voir les langues disponibles pour ce serveur')
    ),

  // ---- Autocomplete dynamique par serveur ----
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
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
      // --- Changer sa langue ---
      if (sub === 'set') {
        const lang = interaction.options.getString('langue');
        const langs = await getServerLangs(guildId);
        if (!langs.includes(lang)) {
          return interaction.reply({
            content: `❌ Langue inconnue pour ce serveur : ${lang}`,
            ephemeral: true,
          });
        }
        await setUserLang(guildId, interaction.user.id, lang);
        return interaction.reply({
          content: `✅ Votre langue personnelle est maintenant **${lang}**`,
          ephemeral: true,
        });
      }

      // --- Voir sa langue ou celle d’un autre utilisateur ---
      if (sub === 'get') {
        const user = interaction.options.getUser('user') || interaction.user;
        const lang = await getLang(guildId, user.id);
        return interaction.reply({
          content: `🌐 La langue de ${user.tag} est : **${lang}**`,
          ephemeral: true,
        });
      }

      // --- Changer la langue du serveur ---
      if (sub === 'server-set') {
        const lang = interaction.options.getString('langue');
        const langs = await getServerLangs(guildId);
        if (!langs.includes(lang)) {
          return interaction.reply({
            content: `❌ Langue inconnue pour ce serveur : ${lang}`,
            ephemeral: true,
          });
        }
        await setServerLang(guildId, lang);
        return interaction.reply({
          content: `✅ Langue du serveur définie sur **${lang}**`,
          ephemeral: false,
        });
      }

      // --- Voir la langue du serveur ---
      if (sub === 'server-get') {
        const lang = await getLang(guildId, null);
        return interaction.reply({
          content: `🌐 La langue du serveur est : **${lang}**`,
          ephemeral: true,
        });
      }

      // --- Liste des langues disponibles pour ce serveur ---
      if (sub === 'list') {
        const langs = await getServerLangs(guildId);
        return interaction.reply({
          content: `🌐 Langues disponibles pour ce serveur : ${langs.join(', ')}`,
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
    }
  },
};
