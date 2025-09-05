const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config');
const database = require('./utils/database');
const Migrations = require('./utils/migrations');
const fs = require('node:fs');
const path = require('node:path');
const XP = require('./models/XP');

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
            name: isDev ? '⚡ Sunatia [DEV] | v1.2.0' : '⚡ Sunatia | v1.2.0',
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
    this.database = database;
    this.config = config;
  }

  async start() {
    try {
      await this.database.connect();
      await Migrations.runMigrations();
      await this.loadCommands();
      await this.loadEvents();
      
      // Initialiser les salons de statistiques
      const { initializeStatsChannels, setClient } = require('./commands/utilities/stats-vocal');
      setClient(this); // Passer l'instance du client à stats-vocal.js
      await initializeStatsChannels();

      const { startBankCron } = require('./utils/bankCron');

      // Enregistrer le handler des boutons help
      const bankCmd = this.commands.get('bank');
      if (bankCmd?.handleButton) {
        this.interactionHandlers.buttons['help'] = async (interaction, action) => {
          await bankCmd.handleButton(interaction);
        };
      }

      const token = this.isDev ? process.env.DISCORD_TOKEN_DEV : process.env.DISCORD_TOKEN;
      await this.login(token);

      startBankCron();
      console.log('📆 Cron bancaire activé');

      this.initXPCache();
      this.registerLeaderboardButtons();

      console.log(`✅ Bot démarré et prêt (${this.isDev ? 'DEV' : 'PROD'})`);
    } catch (error) {
      console.error('❌ Erreur lors du démarrage du bot:', error);
      process.exit(1);
    }
  }

  async loadCommands(dir = path.join(__dirname, 'commands')) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) await this.loadCommands(fullPath);
      else if (file.endsWith('.js')) {
        delete require.cache[require.resolve(fullPath)];
        const command = require(fullPath);
        if ('data' in command && 'execute' in command) {
          this.commands.set(command.data.name, command);
          console.log(`✅ Commande chargée: ${command.data.name}`);
        } else {
          console.warn(`⚠️ La commande à ${fullPath} manque "data" ou "execute"`);
        }
      }
    }
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
      if (action === 'next') newPage++;
      if (action === 'refresh') forceRefresh = true;

      if (leaderboardCmd.displayLeaderboard)
        await leaderboardCmd.displayLeaderboard(interaction, 'money', newPage, forceRefresh);
      else
        await interaction.reply({ content: '❌ Handler leaderboard introuvable', flags: 1 << 6 });
    };

    this.interactionHandlers.buttons['page'] = async (interaction, type, page) => {
      const newPage = parseInt(page) || 1;
      if (leaderboardCmd?.displayLeaderboard) {
        await leaderboardCmd.displayLeaderboard(interaction, type, newPage, false);
      } else {
        await interaction.reply({
          content: '❌ Impossible de charger le classement. Veuillez réessayer.',
          flags: 1 << 6,
        });
      }
    };

    this.interactionHandlers.buttons['refresh'] = async (interaction, type, page) => {
      const newPage = parseInt(page) || 1;
      if (leaderboardCmd?.displayLeaderboard) {
        await leaderboardCmd.displayLeaderboard(interaction, type, newPage, true);
      } else {
        await interaction.reply({
          content: '❌ Impossible de rafraîchir le classement. Veuillez réessayer.',
          flags: 1 << 6,
        });
      }
    };
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
