const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const xpController = require("../../controllers/xpController");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("refresh-cache")
    .setDescription("Rafraîchit le cache d'un utilisateur")
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("L'utilisateur dont on veut rafraîchir le cache")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        content:
          "❌ Vous devez être administrateur pour utiliser cette commande.",
        ephemeral: true,
      });
    }

    const user = interaction.options.getUser("utilisateur");

    try {
      // Vider le cache existant
      xpController.clearCache(user.id, interaction.guildId);

      // Recharger le profil depuis la DB
      const profile = await xpController.getProfile(
        user.id,
        interaction.guildId
      );

      logger.debug(`Cache rafraîchi pour ${user.tag} (${user.id})`);

      return interaction.reply({
        content: `✅ Cache rafraîchi pour ${user.tag} (${user.id})\n**Niveau:** ${profile.level}\n**XP:** ${profile.xp}`,
        ephemeral: true,
      });
    } catch (error) {
      logger.error("Erreur lors du rafraîchissement du cache:", error);
      return interaction.reply({
        content:
          "❌ Une erreur est survenue lors du rafraîchissement du cache.",
        ephemeral: true,
      });
    }
  },
};
