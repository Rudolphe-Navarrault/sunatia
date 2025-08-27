require("dotenv").config();
const { REST, Routes } = require("discord.js");
const readline = require("readline");

const { DISCORD_TOKEN, CLIENT_ID } = process.env;

if (!DISCORD_TOKEN) throw new Error("❌ DISCORD_TOKEN manquant dans .env");
if (!CLIENT_ID) throw new Error("❌ CLIENT_ID manquant dans .env");

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

// Fonction pour demander une confirmation à l'utilisateur
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.toLowerCase());
    })
  );
}

async function cleanGlobalCommands() {
  try {
    console.log("🔍 Récupération des commandes globales...");
    const commands = await rest.get(Routes.applicationCommands(CLIENT_ID));

    if (commands.length === 0) {
      console.log("✅ Aucune commande globale à supprimer");
      return;
    }

    console.log(`⚠️ ${commands.length} commande(s) globale(s) trouvée(s) :`);
    commands.forEach((cmd) => console.log(` - /${cmd.name} (${cmd.id})`));

    for (const command of commands) {
      const answer = await askQuestion(
        `Supprimer /${command.name} ? (oui/non) `
      );
      if (answer === "oui" || answer === "o") {
        await rest.delete(Routes.applicationCommand(CLIENT_ID, command.id));
        console.log(`✅ Supprimée: /${command.name}`);
      } else {
        console.log(`⏭️ Ignorée: /${command.name}`);
      }
    }

    console.log("\n✨ Nettoyage terminé !");
  } catch (error) {
    console.error(
      "❌ Erreur lors du nettoyage des commandes globales :",
      error
    );
  }
}

cleanGlobalCommands();
