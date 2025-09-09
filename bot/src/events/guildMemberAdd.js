const { Events } = require('discord.js');
const { updateMemberCount } = require('../utils/stats-vocal');
const logger = require('../utils/logger');
const User = require('../models/User');
const { GuildSettings } = require('../models/GuildSettings');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    try {
      // Enregistrer uniquement si humain
      if (!member.user.bot) {
        await User.findOrCreate({
          userId: member.id,
          guildId: member.guild.id,
          username: member.user.username,
          discriminator: member.user.discriminator,
          bot: member.user.bot,
          avatar: member.user.avatar,
          joinedAt: member.joinedAt,
        });
        logger.info(`✅ Membre enregistré: ${member.user.tag}`);
      }

      // Mettre à jour le compteur immédiatement
      await updateMemberCount(member.guild);

      // Message de bienvenue
      const settings = await GuildSettings.findOne({ guildId: member.guild.id });
      if (settings?.welcomeChannelId) {
        const welcomeChannel = member.guild.channels.cache.get(settings.welcomeChannelId);
        if (welcomeChannel) {
          await welcomeChannel.send({
            content: `Bienvenue ${member} sur **${member.guild.name}** ! 👋\nTu es le ${member.guild.memberCount.toLocaleString()}ème membre !`,
            allowedMentions: { users: [member.id] },
          });
        }
      }
    } catch (err) {
      logger.error(`❌ Erreur guildMemberAdd pour ${member.user.tag}:`, err);
    }
  },
};
