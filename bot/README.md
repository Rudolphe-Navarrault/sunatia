# Sunatia Bot

Un bot Discord moderne développé avec Discord.js v14+ et MongoDB, offrant une gestion automatique des membres et des statistiques avancées, inspirée de DraftBot.

## 🚀 Fonctionnalités principales

- **Gestion automatique des membres**
  - Synchronisation automatique des membres existants
  - Ajout immédiat des nouveaux membres
  - Mise à jour en temps réel des profils

- **Système de statistiques**
  - Suivi des messages et du temps vocal
  - Système de niveaux et d'XP
  - Classements personnalisables

- **Base de données dynamique**
  - Schéma évolutif pour les utilisateurs
  - Ajout automatique des nouveaux champs
  - Optimisé pour les grands serveurs (10k+ membres)

- **Automatisation complète**
  - Aucune commande manuelle nécessaire
  - Mises à jour automatiques des profils
  - Gestion efficace des ressources

## 🛠 Prérequis

- Node.js 16.9.0 ou supérieur
- Un compte Discord avec un bot créé via le [Portail Développeur Discord](https://discord.com/developers/applications)
- Une base de données MongoDB (locale ou sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register))
- Git (recommandé)

## ⚙️ Installation

1. **Cloner le dépôt**

   ```bash
   git clone [URL_DU_DEPOT]
   cd Bot
   ```

2. **Installer les dépendances**

   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement**
   - Copiez le fichier `.env.example` vers `.env`
   - Remplissez les informations nécessaires dans `.env`

4. **Déployer les commandes**
   - Pour le développement :
     ```bash
     npm run deploy-commands-dev
     ```
   - Pour la production :
     ```bash
     npm run deploy-commands-prod
     ```

## 🚦 Utilisation

### Mode Développement

Pour développer et tester le bot sur un serveur spécifique :

```bash
# Démarrer le bot en mode développement
npm run dev
```

### Mode Production

Pour exécuter le bot en production :

```bash
# Démarrer le bot en mode production
npm run prod
```

## 📁 Structure du Projet

```
Bot/
├── commands/           # Commandes slash
├── events/             # Gestionnaires d'événements
├── models/             # Modèles MongoDB
├── utils/              # Utilitaires et helpers
├── .env                # Configuration
├── deploy-commands.js  # Script de déploiement des commandes
├── index.js            # Point d'entrée
└── package.json        # Dépendances et scripts
```

## 🔧 Commandes Disponibles

- `/ping` - Vérifie la latence du bot

## 🔄 Déploiement

### Commandes

- `(npm run) deploy-commands-dev` : Déploie les commandes sur le serveur de développement
- `npm run dev` : Démarre le bot en mode développement
- `(npm run) deploy-commands-prod` : Déploie les commandes sur tous les serveurs (peut prendre jusqu'à 1h)
- `npm run prod` : Démarre le bot en mode production

### Variables d'environnement

| Variable            | Description                                     |
| ------------------- | ----------------------------------------------- |
| `DISCORD_TOKEN`     | Le token de votre bot Discord                   |
| `DISCORD_CLIENT_ID` | L'ID client de votre application Discord        |
| `MONGODB_URI`       | L'URI de connexion à MongoDB                    |
| `DEV_GUILD_ID`      | (Optionnel) ID du serveur pour le développement |

## 📝 Ajouter une nouvelle commande

1. Créez un nouveau fichier dans le dossier `commands/`
2. Utilisez le modèle suivant :

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nom-de-la-commande')
    .setDescription('Description de la commande'),

  async execute(interaction) {
    // Votre code ici
    await interaction.reply('Réponse de la commande !');
  },
};
```

3. Redéployez les commandes avec `npm run deploy-commands-dev`

## 📜 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📞 Support

Pour toute question ou problème, veuillez ouvrir une issue sur le dépôt.

GITHUB :

Quick setup — if you’ve done this kind of thing before
or
https://github.com/Rudolphe-Navarrault/sunatia.git
Get started by creating a new file or uploading an existing file. We recommend every repository include a README, LICENSE, and .gitignore.

…or create a new repository on the command line
echo "# sunatia" >> README.md
git init
git add README.md (or "." for all files)
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/Rudolphe-Navarrault/sunatia.git
git push -u origin main
…or push an existing repository from the command line
git remote add origin https://github.com/Rudolphe-Navarrault/sunatia.git
git branch -M main
git push -u origin main
