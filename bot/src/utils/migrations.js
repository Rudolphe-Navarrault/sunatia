const User = require("../models/User");
const logger = require("../utils/logger");

/**
 * Classe pour gérer les migrations de la base de données
 */
class Migrations {
  /**
   * Exécute toutes les migrations nécessaires
   */
  static async runMigrations() {
    logger.info("🚀 Démarrage des migrations...");

    try {
      // Migration 1: Ajout des champs manquants aux utilisateurs existants
      await this.addMissingFieldsToUsers();

      // Migration 2: Mise à jour des index
      await this.updateIndexes();

      logger.info("✅ Toutes les migrations ont été appliquées avec succès");
    } catch (error) {
      logger.error("❌ Erreur lors des migrations:", { error });
      throw error;
    }
  }

  /**
   * Ajoute les champs manquants aux utilisateurs existants
   */
  static async addMissingFieldsToUsers() {
    logger.info("🔍 Vérification des champs manquants...");

    const schemaPaths = Object.keys(User.schema.paths);
    const users = await User.find({});
    let updatedCount = 0;

    for (const user of users) {
      let needsUpdate = false;

      for (const path of schemaPaths) {
        if (["_id", "__v", "createdAt", "updatedAt"].includes(path)) continue;

        if (user[path] === undefined || user[path] === null) {
          const schemaType = User.schema.paths[path];

          if (schemaType.isRequired && !user[path]) {
            switch (path) {
              case "username":
                user[path] = `user_${user.userId.substring(0, 8)}`;
                needsUpdate = true;
                break;
              case "guildId":
                if (!user.guildId) user[path] = "unknown_guild";
                needsUpdate = true;
                break;
              default:
                if (schemaType.defaultValue !== undefined) {
                  user[path] =
                    typeof schemaType.defaultValue === "function"
                      ? schemaType.defaultValue()
                      : schemaType.defaultValue;
                  needsUpdate = true;
                } else {
                  switch (schemaType.instance) {
                    case "String":
                      user[path] = "";
                      needsUpdate = true;
                      break;
                    case "Number":
                      user[path] = 0;
                      needsUpdate = true;
                      break;
                    case "Boolean":
                      user[path] = false;
                      needsUpdate = true;
                      break;
                    case "Date":
                      user[path] = new Date();
                      needsUpdate = true;
                      break;
                    case "Array":
                      user[path] = [];
                      needsUpdate = true;
                      break;
                    case "Map":
                    case "Object":
                      user[path] = {};
                      needsUpdate = true;
                      break;
                    default:
                      user[path] = null;
                      needsUpdate = true;
                      break;
                  }
                }
            }
          } else if (schemaType.defaultValue !== undefined) {
            user[path] =
              typeof schemaType.defaultValue === "function"
                ? schemaType.defaultValue()
                : schemaType.defaultValue;
            needsUpdate = true;
          } else {
            user[path] = null;
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        await user.save();
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      logger.info(
        `✅ ${updatedCount} utilisateurs mis à jour avec les champs manquants`
      );
    } else {
      logger.info("✅ Aucun champ manquant détecté");
    }
  }

  /**
   * Met à jour les index de la base de données
   */
  static async updateIndexes() {
    logger.info("🔍 Mise à jour des index...");

    try {
      await User.syncIndexes();
      logger.info("✅ Index mis à jour avec succès");
    } catch (error) {
      logger.error("❌ Erreur lors de la mise à jour des index:", { error });
      throw error;
    }
  }

  /**
   * Nettoie les données inutilisées (facultatif)
   */
  static async cleanupData() {
    logger.info("🧹 Nettoyage des données inutilisées...");

    try {
      const result = await User.deleteMany({
        lastSeen: {
          $lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90), // 90 jours
        },
      });

      if (result.deletedCount > 0) {
        logger.info(
          `🗑️ ${result.deletedCount} utilisateurs inactifs supprimés`
        );
      } else {
        logger.info("✅ Aucune donnée à nettoyer");
      }
    } catch (error) {
      logger.error("❌ Erreur lors du nettoyage des données:", { error });
      throw error;
    }
  }
}

module.exports = Migrations;
