require('dotenv').config();
const {
  Events,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const xpController = require('../controllers/xpController');
const logger = require('../utils/logger');
const axios = require('axios');
const Infraction = require('../models/Infractions');

const userCooldowns = new Map(); // leveling
const userMessages = new Map(); // pour spam
const infractionCooldowns = new Map(); // pour éviter doublons d'infractions

const blockedLinks = ['badwebsite.com', 'malware.com'];

module.exports = {
  name: Events.MessageCreate,
  once: false,

  async execute(message, client) {
    if (message.author.bot) return;

    // --- DMs météo ---
    if (message.channel.type === ChannelType.DM) {
      const city = message.content.trim();
      if (!city) return message.channel.send('❌ Merci de préciser une ville.');

      try {
        const apiKey = process.env.OPENWEATHER_KEY;
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          city
        )}&units=metric&lang=fr&appid=${apiKey}`;

        const response = await axios.get(url);
        const data = response.data;

        return message.channel.send(`🌤 **Météo pour ${data.name}** :
• Température : ${data.main.temp}°C
• Ressenti : ${data.main.feels_like}°C
• Humidité : ${data.main.humidity}%
• Conditions : ${data.weather[0].description}`);
      } catch (err) {
        return message.channel.send(`❌ Impossible de récupérer la météo pour "${city}".`);
      }
    }

    // --- Leveling ---
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

      if (
        blacklistedChannels.has(message.channelId) ||
        message.member.roles.cache.some((r) => blacklistedRoles.has(r.id))
      )
        return;

      const cooldownKey = `${userId}-${guildId}`;
      const lastXpGain = userCooldowns.get(cooldownKey) || 0;
      const now = Date.now();
      if (now - lastXpGain >= cooldown) {
        userCooldowns.set(cooldownKey, now);
        const xpGained = Math.floor(Math.random() * (xpRange.max - xpRange.min + 1)) + xpRange.min;
        const result = await xpController.addXp(userId, guildId, xpGained);
        if (result.leveledUp) {
          const levelUpChannel = client.channels.cache.get(leveling.channelId) || message.channel;
          await levelUpChannel.send({
            content: `🎉 Félicitations <@${userId}>, tu as atteint le niveau **${result.level}** !`,
            allowedMentions: { users: [userId] },
          });
        }
      }
    } catch (err) {
      logger.error('Erreur leveling:', err);
    }

    // --- DÉTECTION INFRACTIONS ---
    await handleInfractions(message, client);
  },
};

async function handleInfractions(message, client) {
  const userId = message.author.id;
  const guild = message.guild;
  const member = message.member;
  const now = Date.now();

  // --- SPAM ---
  if (!userMessages.has(userId)) userMessages.set(userId, []);
  const timestamps = userMessages.get(userId);
  timestamps.push(now);
  const recent = timestamps.filter((ts) => now - ts < 5000);
  userMessages.set(userId, recent);
  if (recent.length > 5) await addInfraction(guild, member, 'spam', message, client);

  // --- LIENS INTERDITS ---
  if (blockedLinks.some((link) => message.content.includes(link))) {
    await addInfraction(guild, member, 'lien', message, client);
    await message.delete().catch(() => {});
  }

  // --- MENTIONS ABUSIVES ---
  if (message.mentions.users.size > 5)
    await addInfraction(guild, member, 'mentions', message, client);

  // --- COMPTE RÉCENT ---
  const accountAge = now - message.author.createdTimestamp;
  if (accountAge < 7 * 24 * 60 * 60 * 1000)
    await addInfraction(guild, member, 'compte', message, client);
}

async function addInfraction(guild, member, type, message, client) {
  const now = Date.now();
  const cooldownKey = `${member.id}-${type}`;
  const last = infractionCooldowns.get(cooldownKey) || 0;
  if (now - last < 5000) return; // ignore si infraction récente
  infractionCooldowns.set(cooldownKey, now);

  // --- Stocker en base ---
  let infraction = await Infraction.findOne({ userId: member.id, guildId: guild.id, type });
  if (infraction) {
    infraction.count += 1;
    infraction.lastDate = new Date();
  } else {
    infraction = new Infraction({ userId: member.id, guildId: guild.id, type });
  }
  await infraction.save();

  // --- Sanctions automatiques ---
  if (infraction.count === 3) {
    const muteRole = guild.roles.cache.find((r) => r.name === 'Muted');
    if (
      muteRole &&
      member.manageable &&
      guild.members.me.roles.highest.position > muteRole.position
    ) {
      await member.roles.add(muteRole);
      setTimeout(() => member.roles.remove(muteRole).catch(() => {}), 10 * 60 * 1000);
      message.channel.send(
        `${member}, tu as été **muté 10 minutes** pour accumulation d'infractions.`
      );
    }
  }
  if (infraction.count >= 5 && member.bannable) {
    await member.ban({ reason: "Accumulation d'infractions" });
    message.channel.send(`${member} a été **banni** pour accumulation d'infractions.`);
  }

  // --- Modal pour explication ---
  const modal = new ModalBuilder()
    .setCustomId(`infraction-${member.id}-${Date.now()}`)
    .setTitle(`Avertissement: ${type}`);

  const input = new TextInputBuilder()
    .setCustomId('raison')
    .setLabel('Explique pourquoi')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Explique ton comportement...')
    .setRequired(false);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  // Avertissement utilisateur
  message.channel.send({
    content: `${member}, infraction détectée : **${type}**. Merci de répondre au modal pour expliquer.`,
  });

  // Pour que le modal fonctionne, il faut gérer l'interactionCreate dans ton index.js ou un autre fichier :
  // client.on('interactionCreate', async (interaction) => { ... })
}
