const { Events } = require('discord.js');
const { scheduleUpdate } = require('../utils/stats-vocal');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,

  async execute(member, client) {
    try {
      logger.info(`Membre parti: ${member.user.tag} de ${member.guild.name}`);

      if (member.user.bot) return;

      // Mettre à jour le compteur
      scheduleUpdate(member.guild);
    } catch (err) {
      logger.error(`Erreur lors du départ du membre ${member.user.tag}:`, err);
    }
  },
};
