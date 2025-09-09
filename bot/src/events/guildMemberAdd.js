const { Events } = require('discord.js');
const { scheduleUpdate } = require('../utils/stats-vocal');
const logger = require('../utils/logger');
const User = require('../models/User');
const { GuildSettings } = require('../models/GuildSettings');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    if (member.user.bot) return;

    try {
      await User.findOrCreate({
        userId: member.id,
        guildId: member.guild.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        bot: member.user.bot,
        avatar: member.user.avatar,
        joinedAt: member.joinedAt,
      });

      logger.info(`✅ Membre enregistré: ${member.user.tag}`);

      scheduleUpdate(member.guild); // 🔥 Mettre à jour le compteur
    } catch (err) {
      logger.error(`Erreur lors de l'ajout du membre ${member.user.tag}:`, err);
    }

    // Envoyer message de bienvenue
    try {
      const settings = await GuildSettings.findOne({ guildId: member.guild.id });
      if (!settings?.welcomeChannelId) return;

      const welcomeChannel = member.guild.channels.cache.get(settings.welcomeChannelId);
      if (!welcomeChannel) return;

      await welcomeChannel.send({
        content: `Bienvenue ${member} sur **${member.guild.name}** ! 👋\nTu es le ${member.guild.memberCount.toLocaleString()}ème membre !`,
        allowedMentions: { users: [member.id] },
      });

      // Mettre à jour le compteur
      scheduleUpdate(member.guild);
    } catch (err) {
      logger.error(`Impossible d'envoyer le message de bienvenue pour ${member.user.tag}:`, err);
    }
  },
};
