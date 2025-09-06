const { Events } = require('discord.js');
const { statsChannels, updateMemberCount } = require('../utils/stats-vocal');

console.log(`[${new Date().toISOString()}] 📥 Chargement de l'événement GuildMemberRemove`);

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,

  async execute(member) {
    console.log('\n' + '='.repeat(80));
    console.log(`[${new Date().toISOString()}] 🚨 Événement GuildMemberRemove DÉCLENCHÉ`);
    console.log(`👤 Membre: ${member.user.tag} (${member.id})`);
    console.log(`🏠 Serveur: ${member.guild.name} (${member.guild.id})`);
    console.log(`👥 Nombre total de membres: ${member.guild.memberCount}`);
    console.log('='.repeat(80) + '\n');
    console.log(`👋 Membre parti: ${member.user.tag} (${member.id}) de ${member.guild.name}`);
    console.log(`🔍 Vérification du salon de statistiques pour le serveur: ${member.guild.id}`);
    
    // Vérifier si un salon de statistiques existe pour ce serveur
    const channelId = statsChannels.get(member.guild.id);
    console.log(`📊 Salon de stats en cache:`, channelId ? `Oui (${channelId})` : 'Non');

    // Mettre à jour le compteur de membres si un salon de stats existe
    if (channelId) {
      console.log(`🔄 Début de la mise à jour du compteur...`);
      try {
        await updateMemberCount(member.guild);
        console.log(`✅ Compteur mis à jour avec succès après le départ de ${member.user.tag}`);
      } catch (error) {
        console.error('❌ Erreur lors de la mise à jour du compteur:', error);
      }
    } else {
      console.log('ℹ️ Aucun salon de statistiques trouvé pour ce serveur');
    }
  },
};
