const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  MessageFlags,
} = require('discord.js');

const COMMANDS_PER_PAGE = 5;

// Cache des pages d'aide par utilisateur
const helpCache = new Map();
let commandsCache = [];

// --- Génération dynamique des catégories ---
function getCategories(client) {
  const categories = client.commandCategories || [];

  const mapping = {
    moderation: { emoji: '🛡️', name: 'Modération' },
    admin: { emoji: '⚙️', name: 'Administration' },
    economy: { emoji: '💰', name: 'Économie' },
    level: { emoji: '📈', name: 'Niveaux' },
    settings: { emoji: '⚙️', name: 'Paramètres' },
    util: { emoji: '🛠️', name: 'Utilitaires' },
    stats: { emoji: '📊', name: 'Statistiques' },
    help: { emoji: '❓', name: 'Aide' },
  };

  return [
    { id: 'all', name: 'Toutes les commandes', emoji: '📚' },
    ...categories.map((cat) => ({
      id: cat,
      name: mapping[cat]?.name || cat,
      emoji: mapping[cat]?.emoji || '📂',
    })),
  ];
}

// --- Mettre en cache les commandes ---
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

// --- Générer l'embed d'aide ---
function generateEmbed(commands, page = 0, category = 'all', client) {
  const filtered = category === 'all' ? commands : commands.filter((c) => c.category === category);

  const totalPages = Math.max(1, Math.ceil(filtered.length / COMMANDS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const slice = filtered.slice(
    currentPage * COMMANDS_PER_PAGE,
    (currentPage + 1) * COMMANDS_PER_PAGE
  );

  const categories = getCategories(client);

  const embed = new EmbedBuilder()
    .setTitle('📚 Aide du Bot')
    .setDescription(
      category === 'all'
        ? 'Toutes les commandes disponibles'
        : `Catégorie: ${categories.find((c) => c.id === category)?.name || category}`
    )
    .setColor('#3498db')
    .setFooter({ text: `Page ${currentPage + 1}/${totalPages}` });

  if (slice.length === 0) {
    embed.addFields({
      name: 'Aucune commande',
      value: 'Cette catégorie est vide.',
    });
  } else {
    slice.forEach((cmd) =>
      embed.addFields({
        name: `/${cmd.name}`,
        value: cmd.description,
        inline: false,
      })
    );
  }

  return {
    embed,
    currentPage,
    totalPages,
    category,
  };
}

// --- Générer les composants d'interface ---
function generateComponents(currentPage, totalPages, category = 'all', client) {
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

  const categories = getCategories(client);

  const select = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_category')
      .setPlaceholder('Sélectionnez une catégorie')
      .addOptions(
        categories.map((c) => ({
          label: c.name,
          value: c.id,
          emoji: c.emoji,
          default: c.id === category,
        }))
      )
  );

  return [nav, select];
}

// --- Gestionnaire des interactions boutons/menus ---
async function handleButton(interaction) {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  if (!helpCache.has(interaction.user.id)) return;

  const state = helpCache.get(interaction.user.id);
  if (interaction.message.id !== state.messageId) return;

  const { commands, currentPage: oldPage, category } = state;
  let newPage = oldPage;
  let newCategory = category;

  if (interaction.isButton()) {
    if (interaction.customId === 'help_prev') {
      newPage = Math.max(0, oldPage - 1);
    } else if (interaction.customId === 'help_next') {
      newPage = oldPage + 1;
    }
  } else if (interaction.isStringSelectMenu() && interaction.customId === 'help_category') {
    newCategory = interaction.values[0];
    newPage = 0;
  }

  const { embed, totalPages } = generateEmbed(commands, newPage, newCategory, interaction.client);
  const components = generateComponents(newPage, totalPages, newCategory, interaction.client);

  await interaction.update({ embeds: [embed], components }).catch(console.error);

  helpCache.set(interaction.user.id, {
    ...state,
    currentPage: newPage,
    category: newCategory,
    totalPages,
  });
}

// --- Commande principale ---
async function execute(interaction) {
  try {
    const commands = cacheCommands(interaction.client);
    const { embed, totalPages } = generateEmbed(commands, 0, 'all', interaction.client);
    const components = generateComponents(0, totalPages, 'all', interaction.client);

    await interaction.reply({
      embeds: [embed],
      components,
      flags: MessageFlags.Ephemeral,
    });

    const message = await interaction.fetchReply();

    helpCache.set(interaction.user.id, {
      messageId: message.id,
      commands,
      currentPage: 0,
      totalPages,
      category: 'all',
      timestamp: Date.now(),
    });

    const filter = (i) => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({
      filter,
      componentType: [ComponentType.Button, ComponentType.StringSelect],
      time: 300000,
    });

    collector.on('collect', async (i) => {
      try {
        await handleButton(i);
      } catch (error) {
        console.error('Erreur dans handleButton:', error);
        if (!i.replied) {
          await i
            .update({ content: '❌ Une erreur est survenue.', components: [] })
            .catch(console.error);
        }
      }
    });

    collector.on('end', () => {
      helpCache.delete(interaction.user.id);
    });
  } catch (error) {
    console.error('Erreur dans la commande help:', error);
    try {
      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({
            content: "❌ Une erreur est survenue lors de l'affichage de l'aide.",
          });
        } else {
          await interaction.reply({
            content: "❌ Une erreur est survenue lors de l'affichage de l'aide.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } catch (e) {
      console.error("Erreur lors de l'envoi du message d'erreur:", e);
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche la liste des commandes disponibles'),

  category: 'utils',
  execute,
  handleButton,
};
