const mongoose = require('mongoose');
const { GuildSettings } = require('../src/models/GuildSettings');
const logger = require('../src/utils/logger');

// Fonction pour initialiser un objet de logSetting
function createLogSetting(channelId = null, enabled = true) {
  return { channelId, enabled };
}

async function migrateLogSettings() {
  try {
    // Connexion à la base de données
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/discord_bot');

    logger.info('Connexion à la base de données réussie');

    // Récupérer tous les paramètres de guilde
    const allSettings = await GuildSettings.find({});
    logger.info(`Migration de ${allSettings.length} configurations de guilde...`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const settings of allSettings) {
      try {
        // Vérifier si la migration a déjà été effectuée
        if (settings.moderation.logSettings && settings.moderation.logSettings.ban && typeof settings.moderation.logSettings.ban === 'object') {
          logger.debug(`La guilde ${settings.guildId} a déjà la nouvelle structure de logs`);
          skippedCount++;
          continue;
        }

        // Initialiser la nouvelle structure de logs
        const logSettings = {
          // Commandes de modération
          ban: createLogSetting(
            settings.moderation.logBans ? settings.moderation.logChannelId : null,
            settings.moderation.logBans !== false
          ),
          unban: createLogSetting(
            settings.moderation.logBans ? settings.moderation.logChannelId : null,
            settings.moderation.logBans !== false
          ),
          kick: createLogSetting(
            settings.moderation.logKicks ? settings.moderation.logChannelId : null,
            settings.moderation.logKicks !== false
          ),
          mute: createLogSetting(
            settings.moderation.logMutes ? settings.moderation.logChannelId : null,
            settings.moderation.logMutes !== false
          ),
          warn: createLogSetting(
            settings.moderation.logWarnings ? settings.moderation.logChannelId : null,
            settings.moderation.logWarnings !== false
          ),
          purge: createLogSetting(
            settings.moderation.logPurges ? settings.moderation.logChannelId : null,
            settings.moderation.logPurges !== false
          ),
          lock: createLogSetting(
            settings.moderation.logLocks ? settings.moderation.logChannelId : null,
            settings.moderation.logLocks !== false
          ),
          unlock: createLogSetting(
            settings.moderation.logLocks ? settings.moderation.logChannelId : null,
            settings.moderation.logLocks !== false
          ),
          slowmode: createLogSetting(
            settings.moderation.logSlowmode ? settings.moderation.logChannelId : null,
            settings.moderation.logSlowmode !== false
          ),
          
          // Commandes temporaires
          tempmute: createLogSetting(
            settings.moderation.logMutes ? settings.moderation.logChannelId : null,
            settings.moderation.logMutes !== false
          ),
          tempban: createLogSetting(
            settings.moderation.logBans ? settings.moderation.logChannelId : null,
            settings.moderation.logBans !== false
          ),
          tempwarn: createLogSetting(
            settings.moderation.logWarnings ? settings.moderation.logChannelId : null,
            settings.moderation.logWarnings !== false
          ),
          
          // Autres événements
          memberUpdate: createLogSetting(
            settings.moderation.logMemberUpdates ? settings.moderation.logChannelId : null,
            settings.moderation.logMemberUpdates === true
          ),
          messageDelete: createLogSetting(
            settings.moderation.logMessageDeletes ? settings.moderation.logChannelId : null,
            settings.moderation.logMessageDeletes === true
          ),
          messageUpdate: createLogSetting(
            settings.moderation.logMessageUpdates ? settings.moderation.logChannelId : null,
            settings.moderation.logMessageUpdates === true
          ),
          roleCreate: createLogSetting(
            settings.moderation.logRoleChanges ? settings.moderation.logChannelId : null,
            settings.moderation.logRoleChanges !== false
          ),
          roleDelete: createLogSetting(
            settings.moderation.logRoleChanges ? settings.moderation.logChannelId : null,
            settings.moderation.logRoleChanges !== false
          ),
          roleUpdate: createLogSetting(
            settings.moderation.logRoleChanges ? settings.moderation.logChannelId : null,
            settings.moderation.logRoleChanges !== false
          ),
          channelCreate: createLogSetting(
            settings.moderation.logChannelChanges ? settings.moderation.logChannelId : null,
            settings.moderation.logChannelChanges !== false
          ),
          channelDelete: createLogSetting(
            settings.moderation.logChannelChanges ? settings.moderation.logChannelId : null,
            settings.moderation.logChannelChanges !== false
          ),
          channelUpdate: createLogSetting(
            settings.moderation.logChannelChanges ? settings.moderation.logChannelId : null,
            settings.moderation.logChannelChanges !== false
          )
        };
        
        // Mettre à jour les paramètres
        settings.moderation.logSettings = logSettings;

        // Marquer comme modifié pour forcer la sauvegarde
        settings.markModified('moderation');
        await settings.save();
        
        migratedCount++;
        logger.debug(`Migration réussie pour la guilde ${settings.guildId}`);
      } catch (error) {
        logger.error(`Erreur lors de la migration pour la guilde ${settings.guildId}:`, error);
      }
    }

    logger.info(`Migration terminée. ${migratedCount} configurations migrées, ${skippedCount} déjà à jour.`);
    process.exit(0);
  } catch (error) {
    logger.error('Erreur lors de la migration:', error);
    process.exit(1);
  }
}

// Exécuter la migration
migrateLogSettings();
