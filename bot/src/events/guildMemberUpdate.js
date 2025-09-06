const { Events } = require('discord.js');
const { statsChannels, updateMemberCount } = require('../utils/stats-vocal');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember, client) {
    try {
      // Vérifier si le membre a changé de salon vocal ou de pseudo
      if (oldMember.voice.channelId !== newMember.voice.channelId || 
          oldMember.nickname !== newMember.nickname ||
          oldMember.user.username !== newMember.user.username) {
            
        const guild = newMember.guild;
        
        // Vérifier si le serveur est dans le cache des salons de statistiques
        if (statsChannels.has(guild.id)) {
          logger.info(`Mise à jour du compteur des membres pour ${guild.name} (${guild.id})`);
          await updateMemberCount(guild);
        }
      }
    } catch (error) {
      logger.error('Erreur dans guildMemberUpdate:', error);
    }
  },
};
