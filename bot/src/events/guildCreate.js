const {
  Events,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

module.exports = {
  name: Events.GuildCreate,
  once: false,

  /**
   * Gère l'événement d'ajout du bot à un serveur
   * @param {Guild} guild - La guilde à laquelle le bot a été ajouté
   * @param {Client} client - L'instance du client Discord
   */
  async execute(guild, client) {
    console.log(
      `\n✨ Le bot a été ajouté au serveur: ${guild.name} (${guild.id})`
    );

    // Synchronisation initiale des membres
    try {
      const { total, synced } = await client.database.syncGuildMembers(guild);
      console.log(
        `✅ ${synced} membres synchronisés sur ${total} pour le serveur ${guild.name}`
      );
    } catch (err) {
      console.error(
        `❌ Erreur lors de la synchronisation des membres pour ${guild.name}:`,
        err
      );
    }

    // Envoi d'un message de bienvenue
    try {
      const systemChannel =
        guild.systemChannel ||
        guild.channels.cache.find(
          (c) =>
            c.type === ChannelType.GuildText &&
            c
              .permissionsFor(guild.members.me)
              .has(PermissionsBitField.Flags.SendMessages)
        );

      if (!systemChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0x7289da)
        .setTitle("👋 Bienvenue sur Sunatia Bot !")
        .setDescription(
          "Merci de m’avoir ajouté à votre serveur ! Je vais automatiquement gérer vos membres et leurs statistiques."
        )
        .addFields(
          {
            name: "Membres synchronisés",
            value: `✅ ${synced} membres synchronisés.`,
            inline: true,
          },
          {
            name: "Configuration",
            value:
              "Utilisez `/config` pour configurer le bot selon vos besoins.",
            inline: true,
          }
        )
        .setFooter({
          text: `Sunatia Bot • ${new Date().getFullYear()}`,
          iconURL: client.user.displayAvatarURL(),
        });

      await systemChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error(
        `❌ Impossible d'envoyer le message de bienvenue sur ${guild.name}:`,
        err
      );
    }
  },
};
