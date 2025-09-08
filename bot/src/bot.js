const {
  Client,
  GatewayIntentBits,
  Collection,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('./config');
const database = require('./utils/database');
const Migrations = require('./utils/migrations');
const fs = require('node:fs');
const path = require('node:path');
const XP = require('./models/XP');

// Permissions
const { userHasPermission, hasCommandPermission } = require('./utils/permission');

class SunatiaBot extends Client {
  constructor(options = {}) {
    const { isDev = false, devGuildId = null } = options;

    const token = isDev ? process.env.DISCORD_TOKEN_DEV : process.env.DISCORD_TOKEN;
    const appId = isDev ? process.env.CLIENT_ID_DEV : process.env.CLIENT_ID;

    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
      allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
      presence: {
        status: 'online',
        activities: [
          {
            name: isDev ? '⚡ Sunatia [DEV] | v1.6.1' : '⚡ Sunatia | v1.6.1',
            type: 4,
          },
        ],
      },
      applicationId: appId,
      messageCacheLifetime: isDev ? 60 : 300,
      messageSweepInterval: isDev ? 30 : 60,
      messageCacheMaxSize: 100,
    });

    this.isDev = isDev;
    this.devGuildId = devGuildId;
    this.commands = new Collection();
    this.events = new Collection();
    this.cooldowns = new Collection();
    this.interactionHandlers = { buttons: {} };
    this.permissionPages = new Collection();
    this.database = database;
    this.config = config;
  }

  async start() {
    try {
      await this.database.connect();
      await Migrations.runMigrations();
      await this.loadCommands();
      await this.loadEvents();
      await this.loadInteractionHandlers();

      const { initializeStatsChannels, setClient } = require('./utils/stats-vocal');
      setClient(this);
      await initializeStatsChannels();

      const { startBankCron } = require('./utils/bankCron');
      startBankCron();
      console.log('📆 Cron bancaire activé');

      this.initXPCache();
      this.registerLeaderboardButtons();
      this.registerPermissionButtons();

      const token = this.isDev ? process.env.DISCORD_TOKEN_DEV : process.env.DISCORD_TOKEN;
      await this.login(token);

      console.log(`✅ Bot démarré et prêt (${this.isDev ? 'DEV' : 'PROD'})`);
    } catch (error) {
      console.error('❌ Erreur lors du démarrage du bot:', error);
      process.exit(1);
    }
  }

  async loadCommands(dir = path.join(__dirname, 'commands')) {
    const loadCommandsFromDir = async (dirPath, isContextMenu = false) => {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.lstatSync(fullPath);

        if (stat.isDirectory()) {
          await loadCommandsFromDir(fullPath, isContextMenu || file === 'context');
        } else if (file.endsWith('.js')) {
          try {
            delete require.cache[require.resolve(fullPath)];
            const command = require(fullPath);

            if ('data' in command && 'execute' in command) {
              if (isContextMenu || fullPath.includes('context/')) {
                this.commands.set(`context:${command.data.name}`, command);
                console.log(`✅ Menu contextuel chargé: ${command.data.name}`);
              } else {
                const categoryName = path.basename(path.dirname(fullPath));
                command.category = categoryName;
                if (!this.commandCategories) this.commandCategories = [];
                if (!this.commandCategories.includes(categoryName)) {
                  this.commandCategories.push(categoryName);
                }

                this.commands.set(command.data.name, command);
                console.log(
                  `✅ Commande chargée: ${command.data.name} (catégorie: ${categoryName})`
                );
              }
            } else {
              console.warn(`⚠️ La commande à ${fullPath} manque "data" ou "execute"`);
            }
          } catch (error) {
            console.error(`❌ Erreur lors du chargement de ${fullPath}:`, error);
          }
        }
      }
    };

    await loadCommandsFromDir(dir);
  }

  async loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      delete require.cache[require.resolve(filePath)];
      const event = require(filePath);

      if (!event.name || !event.execute) continue;

      const executeWithClient = async (...args) => {
        try {
          await event.execute(...args, this);
        } catch (err) {
          console.error(`❌ Erreur dans l'événement ${event.name}:`, err);
        }
      };

      if (event.once) this.once(event.name, executeWithClient);
      else this.on(event.name, executeWithClient);

      console.log(`✅ Événement chargé: ${event.name}`);
    }
  }

  async loadInteractionHandlers() {
    const handlersPath = path.join(__dirname, 'interactionHandlers/buttons');
    const files = fs.readdirSync(handlersPath).filter((f) => f.endsWith('.js'));

    for (const file of files) {
      const filePath = path.join(handlersPath, file);
      delete require.cache[require.resolve(filePath)];
      const handler = require(filePath);

      const name = path.basename(file, '.js'); // ex: "ticket"
      this.interactionHandlers.buttons[name] = handler;
      console.log(`✅ Interaction handler chargé: ${name}`);
    }
  }

  initXPCache() {
    XP.initChangeStream();
    console.log('📦 Cache XP initialisé avec Change Streams');
  }

  registerLeaderboardButtons() {
    const leaderboardCmd = this.commands.get('leaderboard');
    if (!leaderboardCmd) return;

    this.interactionHandlers.buttons['leaderboard'] = async (interaction, action, page) => {
      let newPage = parseInt(page) || 1;
      let forceRefresh = false;

      if (action === 'prev' && newPage > 1) newPage--;
      if (action === 'next' && newPage < totalPages) newPage++;
      if (action === 'refresh') forceRefresh = true;

      if (leaderboardCmd.displayLeaderboard)
        await leaderboardCmd.displayLeaderboard(interaction, 'money', newPage, forceRefresh);
      else
        await interaction.reply({ content: '❌ Handler leaderboard introuvable', flags: 1 << 6 });
    };
  }

  registerPermissionButtons() {
    this.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;

      const [type, action, id] = interaction.customId.split('_');
      if (type !== 'perm') return;

      const pageData = this.permissionPages.get(id);
      if (!pageData)
        return interaction.reply({ content: '❌ Données introuvables.', ephemeral: true });

      let { items, currentPage, totalPages, embed, row } = pageData;

      if (action === 'prev' && currentPage > 1) currentPage--;
      if (action === 'next' && currentPage < totalPages) currentPage++;

      const start = (currentPage - 1) * 5;
      const end = start + 5;

      const newEmbed = embed
        .setDescription(items.slice(start, end).join('\n'))
        .setFooter({ text: `Page ${currentPage}/${totalPages}` });

      const newRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`perm_prev_${id}`)
          .setLabel('⬅️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 1),
        new ButtonBuilder()
          .setCustomId(`perm_next_${id}`)
          .setLabel('➡️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === totalPages)
      );

      await interaction.update({ embeds: [newEmbed], components: [newRow] });

      pageData.currentPage = currentPage;
      this.permissionPages.set(id, pageData);
    });
  }

  // Wrappers pour permissions
  async hasPermission(userId, perm, guildId) {
    return userHasPermission(guildId, userId, perm);
  }

  async hasCommandPermission(userId, commandName, guildId) {
    return hasCommandPermission(guildId, userId, commandName);
  }

  async shutdown() {
    console.log('\nArrêt du bot...');
    try {
      if (XP.closeChangeStream) await XP.closeChangeStream();
      if (this.database && this.database.close) await this.database.close();
      if (this.isReady()) this.destroy();
      console.log('✅ Bot arrêté avec succès');
    } catch (error) {
      console.error("❌ Erreur lors de l'arrêt du bot:", error);
    }
  }
}

module.exports = SunatiaBot;
