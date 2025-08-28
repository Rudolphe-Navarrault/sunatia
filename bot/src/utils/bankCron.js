const BankAccount = require('../models/BankAccount');
const cron = require('node-cron');

// Paramètres par type de compte
const ACCOUNT_SETTINGS = {
  courant: { interest: 0, fee: 0.005 }, // 0.5% frais
  epargne: { interest: 0.02, fee: 0.01 }, // 2% intérêts, 1% frais
  investissement: { interestMin: 0, interestMax: 0.05, fee: 0.02 }, // 0-5% aléatoire, 2% frais
};

// Fonction principale du cron
async function processAccounts() {
  try {
    const accounts = await BankAccount.find({});
    const now = new Date();

    for (const acc of accounts) {
      let interest = 0;
      let fee = 0;

      const settings = ACCOUNT_SETTINGS[acc.type];

      // Intérêts
      if (acc.type === 'investissement') {
        interest =
          acc.balance *
          (Math.random() * (settings.interestMax - settings.interestMin) + settings.interestMin);
      } else {
        interest = acc.balance * settings.interest;
      }

      // Frais
      fee = acc.balance * settings.fee;

      // Ajouter intérêts et soustraire frais
      acc.balance += interest - fee;
      acc.lastInterest = now;
      acc.lastFee = now;

      await acc.save();
    }

    console.log(`✅ BankCron exécuté avec succès pour ${accounts.length} comptes.`);
  } catch (err) {
    console.error('❌ Erreur dans bankCron:', err);
  }
}

// Démarrer le cron
function startBankCron() {
  // Exécution tous les jours à 00:00 pour simuler une application mensuelle (ou ajuster)
  cron.schedule('0 0 * * *', () => {
    console.log('📆 BankCron démarré...');
    processAccounts();
  });

  console.log('📆 BankCron planifié avec succès (toutes les nuits à minuit).');
}

module.exports = { startBankCron, processAccounts };
