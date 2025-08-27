const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const xpController = require("../../controllers/xpController");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear-cache")
    .setDescription("Vide le cache XP (admin uniquement)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
      option
        .setName("utilisateur")
        .setDescription("Utilisateur dont le cache doit être vidé")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const user = interaction.options.getUser("utilisateur");
      let clearedCount = 0;

      if (user) {
        // Vider le cache pour un utilisateur spécifique
        xpController.clearCache(user.id, interaction.guildId);
        clearedCount = 1;
        await interaction.reply({
          content: `✅ Cache XP vidé pour <@${user.id}> (1 entrée)`,
          ephemeral: true,
        });
      } else {
        // Vider tout le cache
        const cacheSize = xpController.cache.size;
        xpController.clearCache();
        clearedCount = cacheSize;
        await interaction.reply({
          content: `✅ Cache XP entièrement vidé pour ce serveur (${clearedCount} entrées supprimées)`,
          ephemeral: true,
        });
      }

      console.log(
        `[Cache] ${interaction.user.tag} a vidé ${clearedCount} entrée(s) du cache XP`
      );
    } catch (error) {
      console.error("Erreur lors de la commande clear-cache:", error);
      if (!interaction.replied) {
        await interaction.reply({
          content:
            "❌ Une erreur est survenue lors de la tentative de vidage du cache",
          ephemeral: true,
        });
      }
    }
  },
};
