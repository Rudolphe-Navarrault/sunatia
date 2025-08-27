#!/usr/bin/env node
require("dotenv").config();
const { REST, Routes } = require("discord.js");

const { DISCORD_TOKEN, CLIENT_ID, DEV_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !DEV_GUILD_ID) {
  throw new Error(
    "❌ DISCORD_TOKEN, CLIENT_ID et DEV_GUILD_ID sont requis dans .env"
  );
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(
      "🧹 Suppression complète de toutes les commandes sur le serveur DEV..."
    );

    // Récupérer toutes les commandes du serveur DEV
    const guildCommands = await rest.get(
      Routes.applicationGuildCommands(CLIENT_ID, DEV_GUILD_ID)
    );

    if (guildCommands.length === 0) {
      console.log("✅ Aucune commande à supprimer sur le serveur DEV");
      return;
    }

    // Supprimer toutes les commandes du serveur DEV
    for (const cmd of guildCommands) {
      await rest.delete(
        Routes.applicationGuildCommand(CLIENT_ID, DEV_GUILD_ID, cmd.id)
      );
      console.log(`🗑️ Supprimée: /${cmd.name} (${cmd.id})`);
    }

    console.log(`✅ ${guildCommands.length} commande(s) DEV supprimée(s)`);
  } catch (err) {
    console.error("❌ ERREUR:", err);
  } finally {
    process.exit(0);
  }
})();
