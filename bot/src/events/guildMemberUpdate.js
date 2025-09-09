const { Events } = require('discord.js');
const { updateMemberCount } = require('../utils/stats-vocal');
const logger = require('../utils/logger');

module.exports = {
  name: Events.GuildMemberUpdate,
  once: false,

  /**
   * Gère la mise à jour d'un membre du serveur
   * @param {GuildMember} oldMember - Le membre avant la mise à jour
   * @param {GuildMember} newMember - Le membre après la mise à jour
   * @param {Client} client - L'instance du client Discord
   */
  async execute(oldMember, newMember, client) {
    try {
      // Vérifier si le membre a changé de salon vocal ou de pseudo
      if (
        oldMember.voice.channelId !== newMember.voice.channelId ||
        oldMember.nickname !== newMember.nickname
      ) {
        const guild = newMember.guild;

        // Mettre à jour le compteur de membres (updateMemberCount gère déjà si aucun salon)
        logger.info(`Mise à jour du compteur pour ${guild.name} (${guild.id})`);
        await updateMemberCount(guild);
      }
    } catch (error) {
      logger.error(`❌ Erreur dans guildMemberUpdate pour ${newMember.user.tag}:`, error);
    }
  },
};
