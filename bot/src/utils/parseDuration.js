/**
 * Parse une durée en chaîne de caractères (ex: 1d2h30m) en millisecondes
 * @param {string} durationStr - La durée à parser (ex: 1d2h30m)
 * @returns {number} Durée en millisecondes
 */
function parseDuration(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') {
    throw new Error('La durée doit être une chaîne de caractères');
  }

  const timeUnits = {
    s: 1000,          // secondes
    m: 60 * 1000,     // minutes
    h: 60 * 60 * 1000, // heures
    d: 24 * 60 * 60 * 1000, // jours
    w: 7 * 24 * 60 * 60 * 1000, // semaines
    M: 30 * 24 * 60 * 60 * 1000, // mois (30 jours)
    y: 365 * 24 * 60 * 60 * 1000 // années (365 jours)
  };

  const regex = /(\d+)([smhdwMy])/g;
  let match;
  let totalMs = 0;
  let hasValidMatch = false;

  while ((match = regex.exec(durationStr)) !== null) {
    hasValidMatch = true;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    if (timeUnits[unit]) {
      totalMs += value * timeUnits[unit];
    }
  }

  if (!hasValidMatch) {
    throw new Error('Format de durée invalide. Utilisez des combinaisons comme 1d, 2h30m, etc.');
  }

  return totalMs;
}

/**
 * Formate une durée en millisecondes en une chaîne lisible
 * @param {number} ms - Durée en millisecondes
 * @returns {string} Durée formatée (ex: 1j 2h 30m)
 */
function formatDuration(ms) {
  if (ms === 0) return '0s';
  
  const units = [
    { value: 365 * 24 * 60 * 60 * 1000, unit: 'a' },
    { value: 30 * 24 * 60 * 60 * 1000, unit: 'mois' },
    { value: 7 * 24 * 60 * 60 * 1000, unit: 'sem' },
    { value: 24 * 60 * 60 * 1000, unit: 'j' },
    { value: 60 * 60 * 1000, unit: 'h' },
    { value: 60 * 1000, unit: 'min' },
    { value: 1000, unit: 's' }
  ];

  const parts = [];
  let remaining = ms;

  for (const { value, unit } of units) {
    const count = Math.floor(remaining / value);
    if (count > 0) {
      parts.push(`${count}${unit}`);
      remaining %= value;
      
      // Limiter à 2 parties pour la lisibilité (ex: 1j 2h au lieu de 1j 2h 30m 15s)
      if (parts.length >= 2) break;
    }
  }

  return parts.join(' ');
}

/**
 * Extrait la durée et la raison d'une chaîne d'arguments
 * @param {string[]} args - Tableau d'arguments
 * @returns {{duration: number, reason: string, durationStr: string}}
 */
function extractDurationAndReason(args) {
  if (!args || args.length === 0) {
    return { duration: 0, reason: 'Aucune raison fournie', durationStr: '0s' };
  }

  // Essayer de trouver un motif de durée dans les premiers arguments
  for (let i = 0; i < Math.min(args.length, 3); i++) {
    try {
      const durationMs = parseDuration(args[i]);
      const durationStr = args[i];
      const reason = [...args.slice(0, i), ...args.slice(i + 1)].join(' ').trim() || 'Aucune raison fournie';
      return { duration: durationMs, reason, durationStr };
    } catch (e) {
      // Ce n'est pas une durée valide, on continue
    }
  }

  // Aucune durée valide trouvée, tout est considéré comme raison
  return {
    duration: 0,
    reason: args.join(' ').trim() || 'Aucune raison fournie',
    durationStr: '0s'
  };
}

module.exports = {
  parseDuration,
  formatDuration,
  extractDurationAndReason
};
