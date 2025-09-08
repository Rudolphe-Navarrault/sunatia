const fs = require('fs');
const path = require('path');
const Language = require('../models/Language');

// Chargement des langues globales depuis /locales
const localesPath = path.join(__dirname, '..', 'locales');
const globalLangs = fs.readdirSync(localesPath).map((f) => f.replace('.json', ''));

// --- Stockage en mémoire par serveur (pour les langues disponibles et la langue par défaut) ---
const serverLangsMap = new Map(); // guildId => { available: [], default: 'en' }

/**
 * Initialise un serveur
 */
function ensureServer(guildId) {
  if (!serverLangsMap.has(guildId)) {
    serverLangsMap.set(guildId, {
      available: [...globalLangs],
      default: 'en',
    });
  }
}

/**
 * Récupère les langues disponibles d’un serveur
 */
async function getServerLangs(guildId) {
  ensureServer(guildId);
  return serverLangsMap.get(guildId).available;
}

/**
 * Définit les langues disponibles pour un serveur
 */
async function setServerLangs(guildId, langs) {
  ensureServer(guildId);
  serverLangsMap.get(guildId).available = langs;
}

/**
 * Récupère la langue par défaut d’un serveur
 */
async function getDefaultLang(guildId) {
  ensureServer(guildId);
  return serverLangsMap.get(guildId).default;
}

/**
 * Définit la langue par défaut d’un serveur
 */
async function setDefaultLang(guildId, lang) {
  ensureServer(guildId);
  serverLangsMap.get(guildId).default = lang;
}

/**
 * Récupère la langue effective pour un utilisateur
 */
async function getLang(guildId, userId) {
  // Priorité utilisateur
  const userLang = await Language.findOne({ guildId, userId });
  if (userLang) return userLang.lang;

  // Langue du serveur
  const serverLang = await Language.findOne({ guildId, userId: null });
  if (serverLang) return serverLang.lang;

  // Sinon langue par défaut du serveur
  return await getDefaultLang(guildId);
}

/**
 * Définit la langue d’un utilisateur
 */
async function setUserLang(guildId, userId, lang) {
  if (lang === null || lang === undefined) {
    await Language.findOneAndDelete({ guildId, userId });
    return;
  }

  const langs = await getServerLangs(guildId);
  if (!langs.includes(lang)) throw new Error('Langue invalide');

  await Language.findOneAndUpdate({ guildId, userId }, { lang }, { upsert: true });
}

/**
 * Définit la langue du serveur
 */
async function setServerLang(guildId, lang) {
  if (lang === null || lang === undefined) {
    await Language.findOneAndDelete({ guildId, userId: null });
    return;
  }

  const langs = await getServerLangs(guildId);
  if (!langs.includes(lang)) throw new Error('Langue invalide');

  await Language.findOneAndUpdate({ guildId, userId: null }, { lang }, { upsert: true });
}

/**
 * Traduction d’une clé
 */
async function t(guildId, key, options = {}, userId = null) {
  const lang = await getLang(guildId, userId);
  const filePath = path.join(localesPath, `${lang}.json`);
  if (!fs.existsSync(filePath)) return key;

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const keys = key.split('.');
  let text = data;
  for (const k of keys) {
    if (text[k] === undefined) return key;
    text = text[k];
  }

  for (const k in options) {
    text = text.replace(new RegExp(`{{?${k}}}?`, 'g'), options[k]);
  }

  return text;
}

module.exports = {
  globalLangs,
  getLang,
  setUserLang,
  setServerLang,
  getServerLangs,
  setServerLangs,
  getDefaultLang,
  setDefaultLang,
  t,
};
