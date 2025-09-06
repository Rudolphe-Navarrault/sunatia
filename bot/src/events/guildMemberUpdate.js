const { Events } = require('discord.js');
const { statsChannels, updateMemberCount } = require('../utils/stats-vocal');

module.exports = {
  name: Events.GuildMemberUpdate,
  once: false,

  async execute(oldMember, newMember) {
    // Vérifier si le membre a changé de statut (rejoint/quitté un salon vocal)
    if (oldMember.voice.channelId !== newMember.voice.channelId) {
      const guild = newMember.guild;
      if (statsChannels.has(guild.id)) {
        updateMemberCount(guild);
      }
    }
  },
};
