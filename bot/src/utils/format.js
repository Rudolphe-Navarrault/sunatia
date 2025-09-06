/**
 * Formate une date dans un format lisible
 * @param {Date} date - La date à formater
 * @returns {string} La date formatée
 */
function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return 'Inconnu';
  
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  };
  
  return date.toLocaleDateString('fr-FR', options);
}

/**
 * Formate une durée relative (ex: "il y a 2 jours")
 * @param {Date} date - La date de référence
 * @returns {string} La durée formatée
 */
function formatRelativeTime(date) {
  if (!(date instanceof Date) || isNaN(date)) return 'Date inconnue';
  
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  const intervals = {
    an: 31536000,
    mois: 2592000,
    semaine: 604800,
    jour: 86400,
    heure: 3600,
    minute: 60,
    seconde: 1
  };
  
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    
    if (interval >= 1) {
      return interval === 1 
        ? `il y a ${interval} ${unit}`
        : `il y a ${interval} ${unit}s`;
    }
  }
  
  return 'à l\'instant';
}

module.exports = {
  formatDate,
  formatRelativeTime
};
