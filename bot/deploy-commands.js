// deploy-commands.js
const { REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Fonction récursive pour charger les commandes
function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const commands = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      commands.push(...loadCommands(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const command = require(fullPath);
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
      } else {
        console.warn(`⚠️ La commande ${entry.name} est invalide`);
      }
    }
  }

  return commands;
}

const commands = loadCommands(path.join(__dirname, 'src/commands'));
const mode = process.argv[2];

(async () => {
  try {
    if (mode === '--dev') {
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN_DEV);

      console.log('🚀 Déploiement des commandes GUILD (dev)...');
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID_DEV, process.env.DEV_GUILD_ID),
        { body: commands }
      );
      console.log(`✅ ${commands.length} commandes guild déployées sur le bot DEV !`);
    } else if (mode === '--prod') {
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

      console.log('🚀 Déploiement des commandes GLOBAL (prod)...');
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
      console.log(`✅ ${commands.length} commandes globales déployées sur le bot PROD !`);
    } else {
      console.log('❌ Argument manquant !');
      console.log('👉 Utilise : node deploy-commands.js --dev OU --prod');
    }
  } catch (error) {
    console.error(error);
  }
})();
