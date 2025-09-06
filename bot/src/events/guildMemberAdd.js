const { Events } = require('discord.js');
const { GuildSettings } = require('../models/GuildSettings');
const { statsChannels, updateMemberCount } = require('../utils/stats-vocal');
const logger = require('../utils/logger');
const User = require('../models/User');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,

  /**
   * Gère l'événement d'arrivée d'un nouveau membre sur le serveur
   * @param {GuildMember} member - Le membre qui a rejoint
   * @param {Client} client - L'instance du client Discord
   */
  async execute(member, client) {
    try {
      logger.info(`Nouveau membre: ${member.user.tag} (${member.id}) sur ${member.guild.name}`);
      
      // Créer ou mettre à jour l'utilisateur dans la base de données
      const user = await User.findOrCreate({
        userId: member.id,
        guildId: member.guild.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        bot: member.user.bot,
        avatar: member.user.avatar,
        joinedAt: member.joinedAt
      });

      logger.info(`✅ Membre enregistré: ${member.user.tag} (${member.id})`);

      // Mettre à jour le compteur de membres si un salon de stats existe
      if (statsChannels.has(member.guild.id)) {
        logger.info(`Mise à jour du compteur pour le nouveau membre: ${member.user.tag}`);
        await updateMemberCount(member.guild);
      }
    } catch (error) {
      logger.error(`Erreur lors de l'enregistrement du membre ${member.user.tag}:`, error);
    }

    // Envoyer un message de bienvenue
    try {
      const settings = await GuildSettings.findOne({ guildId: member.guild.id });
      if (!settings || !settings.welcomeChannelId) return;

      const welcomeChannel = member.guild.channels.cache.get(settings.welcomeChannelId);
      if (!welcomeChannel) return;

      const welcomeMessage =
        `Bienvenue ${member} sur **${member.guild.name}** ! 👋\n` +
        `Tu es le ${member.guild.memberCount.toLocaleString()}ème membre !`;

      await welcomeChannel.send({
        content: welcomeMessage,
        allowedMentions: { users: [member.id] },
      });
    } catch (err) {
      console.error(
        `❌ Impossible d'envoyer le message de bienvenue pour ${member.user.tag}:`,
        err
      );
    }
  },
};
