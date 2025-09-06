const { Events, ChannelType, PermissionsBitField } = require('discord.js');
const { GuildSettings } = require('../models/GuildSettings');
const { statsChannels, updateMemberCount } = require('../utils/stats-vocal');

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,

  /**
   * Gère l'événement d'arrivée d'un nouveau membre sur le serveur
   * @param {GuildMember} member - Le membre qui a rejoint
   * @param {Client} client - L'instance du client Discord
   */
  async execute(member, client) {
    console.log(`👋 Nouveau membre: ${member.user.tag} (${member.id}) sur ${member.guild.name}`);

    // Créer ou mettre à jour l'utilisateur dans la base de données
    try {
      const user = await client.database.getUser({
        id: member.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        avatar: member.user.avatar,
        bot: member.user.bot,
        guildId: member.guild.id,
      });

      // Mettre à jour la date d'arrivée si nécessaire
      if (member.joinedAt && (!user.joinedAt || user.joinedAt > member.joinedAt)) {
        user.joinedAt = member.joinedAt;
        await user.save();
      }

      console.log(`✅ Membre enregistré: ${member.user.tag} (${member.id})`);

      // Mettre à jour le compteur de membres si un salon de stats existe
      if (statsChannels.has(member.guild.id)) {
        updateMemberCount(member.guild);
      }
    } catch (err) {
      console.error(`❌ Erreur lors de l'enregistrement du membre ${member.user.tag}:`, err);
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
