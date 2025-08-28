#!/usr/bin/env node
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- Détermination du mode ---
const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const isProd = args.includes('--prod');

if (!isDev && !isProd) {
  console.error('❌ Indiquez un mode: --dev ou --prod');
  process.exit(1);
}

// --- Configuration des tokens en fonction de l'environnement ---
let DISCORD_TOKEN, CLIENT_ID, DEV_GUILD_ID;

if (isDev) {
  DISCORD_TOKEN = process.env.DISCORD_TOKEN_DEV;
  CLIENT_ID = process.env.CLIENT_ID_DEV;
  DEV_GUILD_ID = process.env.DEV_GUILD_ID;

  if (!DISCORD_TOKEN || !CLIENT_ID || !DEV_GUILD_ID) {
    throw new Error('❌ En mode DEV, DISCORD_TOKEN_DEV, CLIENT_ID_DEV et DEV_GUILD_ID sont requis');
  }
} else {
  DISCORD_TOKEN = process.env.DISCORD_TOKEN;
  CLIENT_ID = process.env.CLIENT_ID;
  DEV_GUILD_ID = process.env.DEV_GUILD_ID || null; // optionnel en prod

  if (!DISCORD_TOKEN || !CLIENT_ID) {
    throw new Error('❌ Les tokens Discord sont manquants dans le fichier .env');
  }
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

// --- Récupération des commandes ---
const commands = [];
const commandsPath = path.join(__dirname, 'src/commands');

function readCommands(dir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      readCommands(fullPath);
    } else if (file.endsWith('.js')) {
      try {
        const command = require(fullPath);
        if (command.data && command.execute) {
          commands.push(command.data.toJSON());
        } else {
          console.warn(`⚠️ Commande ignorée (data/execute manquants) : ${file}`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors du chargement de ${file}:`, error);
      }
    }
  });
}

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

console.log(`📋 ${uniqueCommands.length} commande(s) unique(s) prête(s) à déployer`);

// --- Fonctions de nettoyage ---
async function cleanupGuildCommands(guildId) {
  if (!guildId) return;
  const existing = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, guildId));
  for (const cmd of existing) {
    await rest.delete(Routes.applicationGuildCommand(CLIENT_ID, guildId, cmd.id));
  }
  console.log(`🗑️ Nettoyage complet des guild commands sur ${guildId}`);
}

async function cleanupGlobalCommands() {
  const existing = await rest.get(Routes.applicationCommands(CLIENT_ID));
  for (const cmd of existing) {
    await rest.delete(Routes.applicationCommand(CLIENT_ID, cmd.id));
  }
  console.log('🗑️ Nettoyage complet des global commands');
}

// --- Déploiement ---
(async () => {
  try {
    if (isDev) {
      console.log('=== Déploiement DEV ===');
      await cleanupGuildCommands(DEV_GUILD_ID);
      const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, DEV_GUILD_ID), {
        body: uniqueCommands,
      });
      console.log(`✅ ${data.length} commande(s) déployée(s) sur le serveur DEV`);
    } else if (isProd) {
      console.log('=== Déploiement PROD (global) ===');
      await cleanupGlobalCommands();
      const data = await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: uniqueCommands,
      });
      console.log(`✅ ${data.length} commande(s) déployée(s) globalement`);
      console.log('⚠️ Les commandes globales peuvent mettre jusqu’à 1h pour apparaître');

      // Nettoyer DEV si DEV_GUILD_ID défini
      if (DEV_GUILD_ID) {
        console.log('⚠️ Nettoyage des commandes DEV pour éviter doublons');
        await cleanupGuildCommands(DEV_GUILD_ID);
      }
    }

    console.log('🎉 Déploiement terminé !');
  } catch (err) {
    console.error('❌ ERREUR:', err);
  }
})();
