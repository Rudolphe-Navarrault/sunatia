const { Events } = require('discord.js');
const { updateMemberCount } = require('../utils/stats-vocal');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,

  /**
   * Gère l'événement de départ d'un membre du serveur
   * @param {GuildMember} member - Le membre qui est parti
   * @param {Client} client - L'instance du client Discord
   */
  async execute(member, client) {
    try {
      logger.info(`Membre parti: ${member.user.tag} (${member.id}) de ${member.guild.name}`);

      // Ne pas traiter les bots
      if (member.user.bot) return;

      // 🔥 Mettre à jour le compteur de membres avec un petit délai
      setTimeout(async () => {
        await member.guild.members.fetch(); // s'assure que memberCount est à jour
        await updateMemberCount(member.guild);
      }, 1000); // 1 seconde
    } catch (error) {
      logger.error(`Erreur lors du traitement du départ de ${member.user.tag}:`, error);
    }
  },
};
