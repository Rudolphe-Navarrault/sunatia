// deploy-commands.js
const { REST, Routes, ApplicationCommandType } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Fonction récursive pour charger les commandes
function loadCommands(dir, isContextMenu = false) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const commands = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const isContextDir = entry.name === 'context' || isContextMenu;

    if (entry.isDirectory()) {
      commands.push(...loadCommands(fullPath, isContextDir));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      try {
        delete require.cache[require.resolve(fullPath)];
        const command = require(fullPath);
        
        if ('data' in command && 'execute' in command) {
          const commandData = command.data.toJSON();
          
          // Si c'est une commande de menu contextuel, s'assurer qu'elle a le bon type
          if (isContextMenu || fullPath.includes('context/')) {
            if (!commandData.type) {
              commandData.type = ApplicationCommandType.User; // Par défaut, menu contextuel utilisateur
            }
          }
          
          commands.push(commandData);
          console.log(`✅ Commande chargée: ${commandData.name} (${commandData.type || 'Slash'})`);
        } else {
          console.warn(`⚠️ La commande ${entry.name} est invalide (manque data ou execute)`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors du chargement de la commande ${fullPath}:`, error);
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
