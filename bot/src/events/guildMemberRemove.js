const { Events } = require('discord.js');
const { updateMemberCount } = require('../utils/stats-vocal');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member) {
    try {
      logger.info(`Membre parti: ${member.user.tag} de ${member.guild.name}`);

      // Toujours mettre à jour le compteur, même pour les bots
      await updateMemberCount(member.guild);
    } catch (err) {
      logger.error(`❌ Erreur guildMemberRemove pour ${member.user.tag}:`, err);
    }
  },
};
