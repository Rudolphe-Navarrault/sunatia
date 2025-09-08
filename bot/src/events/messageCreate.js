require('dotenv').config();
const { Events, ChannelType } = require('discord.js');
const xpController = require('../controllers/xpController');
const logger = require('../utils/logger');
const axios = require('axios');

const userCooldowns = new Map();

module.exports = {
  name: Events.MessageCreate,
  once: false,

  async execute(message, client) {
    // Ignorer les bots
    if (message.author.bot) return;

    // --- DMs pour la météo ---
    if (message.channel.type === ChannelType.DM) {
      const city = message.content.trim();
      if (!city) {
        return message.channel.send('❌ Merci de préciser une ville. Exemple : `Paris`');
      }

      try {
        const apiKey = process.env.OPENWEATHER_KEY;
        if (!apiKey) throw new Error('Clé API OpenWeather non définie');

        // Appel API météo (gratuit)
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          city
        )}&units=metric&lang=fr&appid=${apiKey}`;

        const response = await axios.get(url);
        const data = response.data;

        const reply = `🌤 **Météo pour ${data.name}** :
    • Température : ${data.main.temp}°C
    • Ressenti : ${data.main.feels_like}°C
    • Humidité : ${data.main.humidity}%
    • Conditions : ${data.weather[0].description}`;

        return message.channel.send(reply);
      } catch (err) {
        console.error(err);
        return message.channel.send(
          `❌ Impossible de récupérer la météo pour "${city}". Vérifie l'orthographe ou réessaie plus tard !`
        );
      }
    }

    // --- Messages en serveur pour le leveling ---
    if (!message.guild || message.content.length < 5) return;

    const userId = message.author.id;
    const guildId = message.guild.id;

    try {
      const guildSettings = await xpController.getGuildSettings(guildId);
      const leveling = guildSettings.leveling || {};

      const cooldown = leveling.cooldown ?? 60000;
      const xpRange = leveling.xpRange ?? { min: 10, max: 20 };
      const blacklistedChannels = new Set(leveling.blacklistedChannels || []);
      const blacklistedRoles = new Set(leveling.blacklistedRoles || []);

      // Vérifier blacklist canal et rôle
      if (
        blacklistedChannels.has(message.channelId) ||
        message.member.roles.cache.some((role) => blacklistedRoles.has(role.id))
      )
        return;

      // Cooldown
      const cooldownKey = `${userId}-${guildId}`;
      const lastXpGain = userCooldowns.get(cooldownKey) || 0;
      const now = Date.now();
      if (now - lastXpGain < cooldown) return;
      userCooldowns.set(cooldownKey, now);

      // Calculer XP aléatoire
      const xpGained = Math.floor(Math.random() * (xpRange.max - xpRange.min + 1)) + xpRange.min;

      // Ajouter XP
      const result = await xpController.addXp(userId, guildId, xpGained);
      logger.debug(`XP ajoutée: ${xpGained} XP pour ${message.author.tag}`);

      // Si level-up
      if (result.leveledUp) {
        logger.info(`Niveau ${result.level} atteint par ${message.author.tag}`);

        const levelUpChannel = client.channels.cache.get(leveling.channelId) || message.channel;

        await levelUpChannel.send({
          content: `🎉 Félicitations <@${userId}>, tu as atteint le niveau **${result.level}** !`,
          allowedMentions: { users: [userId] },
        });
      }
    } catch (error) {
      logger.error('Erreur lors du traitement du message pour le leveling:', error);
    }
  },
};
