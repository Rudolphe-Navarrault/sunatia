#!/usr/bin/env node
require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const { DISCORD_TOKEN, CLIENT_ID, DEV_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  throw new Error("❌ DISCORD_TOKEN et CLIENT_ID requis dans .env");
}

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

// --- Détermination du mode ---
const args = process.argv.slice(2);
const isDev = args.includes("--dev");
const isProd = args.includes("--prod");

if (!isDev && !isProd) {
  console.error("❌ Indiquez un mode: --dev ou --prod");
  process.exit(1);
}

// --- Récupération des commandes ---
const commands = [];
const commandsPath = path.join(__dirname, "src/commands");

// Fonction récursive pour lire les fichiers dans les sous-dossiers
function readCommands(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      readCommands(fullPath);
    } else if (file.endsWith(".js")) {
      try {
        const command = require(fullPath);
        if (command.data && command.execute) {
          commands.push(command.data.toJSON());
        }
      } catch (error) {
        console.error(
          `❌ Erreur lors du chargement de la commande ${file}:`,
          error
        );
      }
    }
  });
}

// Lancer la lecture récursive des commandes
readCommands(commandsPath);
console.log(`📋 ${commands.length} commande(s) chargée(s)`);

// --- Déduplication par nom ---
const seen = new Set();
const uniqueCommands = [];

for (const cmd of commands) {
  if (seen.has(cmd.name)) {
    console.warn(`⚠️ Commande en double ignorée: ${cmd.name}`);
    continue;
  }
  seen.add(cmd.name);
  uniqueCommands.push(cmd);
}

console.log(
  `📋 ${uniqueCommands.length} commande(s) unique(s) prête(s) à déployer`
);

// --- Fonctions de nettoyage ---
async function cleanupGuildCommands(guildId) {
  if (!guildId) return;
  const existing = await rest.get(
    Routes.applicationGuildCommands(CLIENT_ID, guildId)
  );
  for (const cmd of existing) {
    await rest.delete(
      Routes.applicationGuildCommand(CLIENT_ID, guildId, cmd.id)
    );
  }
  console.log(`🗑️ Nettoyage complet des guild commands sur ${guildId}`);
}

async function cleanupGlobalCommands() {
  const existing = await rest.get(Routes.applicationCommands(CLIENT_ID));
  for (const cmd of existing) {
    await rest.delete(Routes.applicationCommand(CLIENT_ID, cmd.id));
  }
  console.log("🗑️ Nettoyage complet des global commands");
}

// --- Déploiement ---
(async () => {
  try {
    if (isDev) {
      if (!DEV_GUILD_ID)
        throw new Error("❌ DEV_GUILD_ID requis pour le mode DEV");
      console.log("=== Déploiement DEV ===");

      // 🔹 Nettoyer uniquement les guild commands
      await cleanupGuildCommands(DEV_GUILD_ID);

      // 🔹 Déploiement guild commands DEV
      const data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, DEV_GUILD_ID),
        { body: uniqueCommands }
      );
      console.log(
        `✅ ${data.length} commande(s) déployée(s) sur le serveur DEV`
      );
    } else if (isProd) {
      console.log("=== Déploiement PROD (global) ===");

      // 🔹 Nettoyage global commands
      await cleanupGlobalCommands();

      // 🔹 Déploiement global
      const data = await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: uniqueCommands,
      });
      console.log(`✅ ${data.length} commande(s) déployée(s) globalement`);
      console.log(
        "⚠️ Les globales peuvent mettre jusqu’à 1h pour apparaître sur tous les serveurs"
      );

      // 🔹 Nettoyage des doublons sur le serveur DEV
      if (DEV_GUILD_ID) {
        const guildCmds = await rest.get(
          Routes.applicationGuildCommands(CLIENT_ID, DEV_GUILD_ID)
        );
        for (const cmd of guildCmds) {
          await rest.delete(
            Routes.applicationGuildCommand(CLIENT_ID, DEV_GUILD_ID, cmd.id)
          );
        }
        console.log(
          "⚠️ Les commandes globales ont été retirées du serveur DEV pour éviter les doublons"
        );
      }
    }

    console.log("🎉 Déploiement terminé !");
  } catch (err) {
    console.error("❌ ERREUR:", err);
  } finally {
    process.exit(0);
  }
})();
