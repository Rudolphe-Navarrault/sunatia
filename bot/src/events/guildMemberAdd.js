const { Events } = require('discord.js');
const { scheduleUpdate } = require('../utils/stats-vocal');
const logger = require('../utils/logger');
const User = require('../models/User');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,

  async execute(member, client) {
    try {
      logger.info(`Nouveau membre: ${member.user.tag} sur ${member.guild.name}`);

      await User.findOrCreate({
        userId: member.id,
        guildId: member.guild.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        bot: member.user.bot,
        avatar: member.user.avatar,
        joinedAt: member.joinedAt,
      });

      // Mettre à jour le compteur
      scheduleUpdate(member.guild);
    } catch (err) {
      logger.error(`Erreur lors de l'ajout du membre ${member.user.tag}:`, err);
    }
  },
};
