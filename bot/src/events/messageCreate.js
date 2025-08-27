const { Events } = require("discord.js");
const xpController = require("../controllers/xpController");
const logger = require("../utils/logger");

const userCooldowns = new Map();

module.exports = {
  name: Events.MessageCreate,
  once: false,

  /**
   * Gère l'événement de création de message
   * @param {Message} message - Le message reçu
   * @param {Client} client - L'instance du client Discord
   */
  async execute(message, client) {
    // Ignorer bots, DM et messages trop courts
    if (message.author.bot || !message.guild || message.content.length < 5)
      return;

    const userId = message.author.id;
    const guildId = message.guild.id;

    try {
      // Récupérer la config serveur depuis la DB
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
      const xpGained = Math.floor(
        Math.random() * (xpRange.max - xpRange.min + 1) + xpRange.min
      );

      // Ajouter XP
      const result = await xpController.addXp(userId, guildId, xpGained);
      logger.debug(`XP ajoutée: ${xpGained} XP pour ${message.author.tag}`);

      // Si level-up
      if (result.leveledUp) {
        logger.info(`Niveau ${result.level} atteint par ${message.author.tag}`);

        const levelUpChannel =
          client.channels.cache.get(leveling.channelId) || message.channel;

        await levelUpChannel.send({
          content: `🎉 Félicitations <@${userId}>, tu as atteint le niveau **${result.level}** !`,
          allowedMentions: { users: [userId] },
        });

        // TODO: Ajouter rôles/rewards selon niveau si nécessaire
      }
    } catch (error) {
      logger.error(
        "Erreur lors du traitement du message pour le leveling:",
        error
      );
    }
  },
};
