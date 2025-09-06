const { Events } = require('discord.js');
const { statsChannels, updateMemberCount } = require('../utils/stats-vocal');
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
      
      // Vérifier si un salon de statistiques est configuré pour ce serveur
      if (statsChannels.has(member.guild.id)) {
        logger.info(`Mise à jour du compteur après le départ de ${member.user.tag}`);
        await updateMemberCount(member.guild);
      }
      
      // Vous pouvez ajouter ici d'autres actions à effectuer lors du départ d'un membre
      // Par exemple, envoyer un message dans un salon de logs
      
    } catch (error) {
      logger.error(`Erreur lors du traitement du départ de ${member.user.tag}:`, error);
    }
  },
};
