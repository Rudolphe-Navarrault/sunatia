const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

const COMMANDS_PER_PAGE = 5;
const CATEGORIES = [
  { id: 'all', name: 'Toutes les commandes', emoji: '📚' },
  { id: 'moderation', name: 'Modération', emoji: '🛡️' },
  { id: 'admin', name: 'Administration', emoji: '⚙️' },
  { id: 'economy', name: 'Économie', emoji: '💰' },
  { id: 'level', name: 'Niveaux', emoji: '📈' },
  { id: 'settings', name: 'Paramètres', emoji: '⚙️' },
];

// --- Cache des commandes ---
let commandsCache = [];

function cacheCommands(client) {
  if (commandsCache.length > 0) return commandsCache;

  const cmds = [];
  client.commands.forEach((c) => {
    cmds.push({
      name: c.data.name,
      description: c.data.description || 'Aucune description',
      category: c.category || 'all',
    });
  });

  commandsCache = cmds;
  return commandsCache;
}

// --- Générer embed ---
function generateEmbed(commands, page = 0, category = 'all') {
  const filtered = category === 'all' ? commands : commands.filter((c) => c.category === category);
  const totalPages = Math.max(1, Math.ceil(filtered.length / COMMANDS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const slice = filtered.slice(
    currentPage * COMMANDS_PER_PAGE,
    (currentPage + 1) * COMMANDS_PER_PAGE
  );

  const embed = new EmbedBuilder()
    .setTitle('📚 Aide du Bot')
    .setDescription(`Page ${currentPage + 1}/${totalPages}`)
    .setColor('#3498db');

  if (slice.length === 0)
    embed.addFields({ name: 'Aucune commande', value: 'Cette catégorie est vide.' });
  else
    slice.forEach((cmd) =>
      embed.addFields({ name: `/${cmd.name}`, value: cmd.description, inline: false })
    );

  return { embed, currentPage, totalPages };
}

// --- Générer composants ---
function generateComponents(currentPage, totalPages) {
  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('help_prev')
      .setLabel('◀️ Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId('help_next')
      .setLabel('Suivant ▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1)
  );

  const select = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Sélectionnez une catégorie')
      .addOptions(CATEGORIES.map((c) => ({ label: c.name, value: c.id, emoji: c.emoji })))
  );

  return [nav, select];
}

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Affiche la liste des commandes'),

  async execute(interaction) {
    const commands = cacheCommands(interaction.client);
    const { embed, totalPages } = generateEmbed(commands);
    const components = generateComponents(0, totalPages);
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
  },
};
