/**
 * Configuration des couleurs pour les différents types de logs
 * Ces couleurs sont utilisées pour les embeds de logs Discord
 */

module.exports = {
  // Commandes de modération
  ban: '#ff3b30',     // Rouge vif pour les bannissements
  unban: '#34c759',    // Vert pour les débannissements
  kick: '#ff9500',     // Orange pour les exclusions
  mute: '#ffcc00',     // Jaune pour les réductions au silence
  warn: '#ff9500',     // Orange pour les avertissements
  purge: '#5ac8fa',    // Bleu clair pour les purges
  lock: '#ff2d55',     // Rose pour les verrouillages
  unlock: '#34c759',   // Vert pour les déverrouillages
  slowmode: '#5ac8fa', // Bleu clair pour le mode lent
  
  // Commandes temporaires
  tempmute: '#ffcc00', // Jaune pour les réductions au silence temporaires
  tempban: '#ff3b30',  // Rouge vif pour les bannissements temporaires
  tempwarn: '#ff9500', // Orange pour les avertissements temporaires
  
  // Événements de modération
  memberUpdate: '#af52de', // Violet pour les mises à jour de membres
  messageDelete: '#ff2d55',// Rose pour les suppressions de messages
  messageUpdate: '#5ac8fa',// Bleu clair pour les modifications de messages
  
  // Événements de serveur
  roleCreate: '#34c759',   // Vert pour la création de rôles
  roleDelete: '#ff3b30',   // Rouge pour la suppression de rôles
  roleUpdate: '#ff9500',   // Orange pour la modification de rôles
  channelCreate: '#34c759',// Vert pour la création de salons
  channelDelete: '#ff3b30',// Rouge pour la suppression de salons
  channelUpdate: '#ff9500',// Orange pour la modification de salons
  
  // Par défaut
  default: '#8e8e93'       // Gris pour les types non spécifiés
};
