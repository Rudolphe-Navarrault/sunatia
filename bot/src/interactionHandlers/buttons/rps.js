// src/interactionHandlers/buttons/rps.js
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  // --- Créer un duel ---
  createGame(message, opponentId, client) {
    if (!client.activeGames) client.activeGames = new Map();
    client.activeGames.set(message.id, { players: new Map(), opponentId });
  },

  // --- Gérer les interactions ---
  async execute(interaction, action, client) {
    try {
      if (!client.activeGames) client.activeGames = new Map();
      const activeGames = client.activeGames;
      const messageId = interaction.message.id;

      if (!activeGames.has(messageId)) {
        return interaction.reply({ content: '❌ Ce duel n’existe plus.', flags: 1 << 6 });
      }

      const game = activeGames.get(messageId);
      const { players, opponentId } = game;

      // Vérifie si l'utilisateur est dans ce duel
      if (![interaction.user.id, opponentId].includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Tu n’es pas dans ce duel !', flags: 1 << 6 });
      }

      // Vérifie si l'utilisateur a déjà choisi
      if (players.has(interaction.user.id)) {
        return interaction.reply({ content: '❌ Tu as déjà choisi !', flags: 1 << 6 });
      }

      const choice = action.replace('rps_', '');
      players.set(interaction.user.id, choice);

      await interaction.reply({ content: `✅ Tu as choisi : ${choice}`, flags: 1 << 6 });

      // Duel contre le bot
      if (opponentId === client.user.id) {
        const botChoice = ['pierre', 'feuille', 'ciseaux'][Math.floor(Math.random() * 3)];
        players.set(client.user.id, botChoice);
      }

      const expectedPlayers = opponentId === client.user.id ? 1 : 2;

      if (players.size >= expectedPlayers) {
        const userId = [...players.keys()].find((id) => id !== opponentId);
        const userChoice = players.get(userId);
        const opponentChoice = players.get(opponentId);

        let resultText = '';
        if (userChoice === opponentChoice) resultText = 'Égalité ! 🤝';
        else if (
          (userChoice === 'pierre' && opponentChoice === 'ciseaux') ||
          (userChoice === 'feuille' && opponentChoice === 'pierre') ||
          (userChoice === 'ciseaux' && opponentChoice === 'feuille')
        )
          resultText = `<@${userId}> gagne ! 🎉`;
        else resultText = `<@${opponentId}> gagne ! 😎`;

        const resultEmbed = new EmbedBuilder()
          .setTitle('🎮 Résultat Pierre-Feuille-Ciseaux')
          .setDescription(
            `<@${userId}>: ${userChoice}\n<@${opponentId}>: ${opponentChoice}\n\n**${resultText}**`
          )
          .setColor(resultText.includes('gagne') ? 'Green' : 'Yellow');

        // Supprime les boutons et affiche le résultat
        await interaction.message.edit({ embeds: [resultEmbed], components: [] });
        activeGames.delete(messageId);
      }
    } catch (err) {
      console.error('❌ Erreur interaction RPS:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ Une erreur est survenue.', flags: 1 << 6 });
      }
    }
  },
};
