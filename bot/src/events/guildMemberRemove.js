const { Events } = require('discord.js');
const { scheduleUpdate } = require('../utils/stats-vocal');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member) {
    if (member.user.bot) return;

    logger.info(`Membre parti: ${member.user.tag}`);
    scheduleUpdate(member.guild); // 🔥 Mettre à jour le compteur
  },
};
