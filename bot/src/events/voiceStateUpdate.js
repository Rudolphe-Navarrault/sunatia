const { Events } = require("discord.js");
const voiceTime = new Map(); // Cache pour les temps en vocal

module.exports = {
  name: Events.VoiceStateUpdate,
  once: false,

  /**
   * Gère les changements d'état vocal des membres
   * @param {VoiceState} oldState
   * @param {VoiceState} newState
   * @param {Client} client
   */
  async execute(oldState, newState, client) {
    if (!oldState.guild || !newState.guild) return;
    if (oldState.channelId === newState.channelId) return;

    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    try {
      const user = await client.database.getUser({
        id: member.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar: member.user.avatar,
        bot: member.user.bot,
        guildId: member.guild.id,
      });

      const now = Date.now();
      const userKey = `${member.guild.id}-${member.id}`;

      const updateVoiceTime = (seconds) => {
        user.stats.voiceTime = (user.stats.voiceTime || 0) + seconds;
      };

      // Rejoint un salon
      if (newState.channelId && !oldState.channelId) {
        console.log(`🔊 ${member.user.tag} a rejoint ${newState.channel.name}`);
        voiceTime.set(userKey, now);
        user.stats.lastVoiceJoin = new Date();
        await user.save();
      }

      // Quitte un salon
      else if (!newState.channelId && oldState.channelId) {
        const joinTime = voiceTime.get(userKey);
        if (joinTime) {
          const secondsSpent = Math.floor((now - joinTime) / 1000);
          console.log(
            `🔇 ${member.user.tag} a quitté le vocal après ${secondsSpent}s`
          );
          updateVoiceTime(secondsSpent);
          await user.save();
          voiceTime.delete(userKey);
        }
      }

      // Change de salon
      else if (
        oldState.channelId &&
        newState.channelId &&
        oldState.channelId !== newState.channelId
      ) {
        const joinTime = voiceTime.get(userKey) || now;
        const secondsSpent = Math.floor((now - joinTime) / 1000);
        updateVoiceTime(secondsSpent);
        voiceTime.set(userKey, now);
        await user.save();
        console.log(
          `🔄 ${member.user.tag} a changé de salon (${secondsSpent}s dans l'ancien)`
        );
      }
    } catch (error) {
      console.error(
        `❌ Erreur lors du traitement vocal pour ${
          member?.user?.tag || "unknown"
        }:`,
        error
      );
    }
  },
};
