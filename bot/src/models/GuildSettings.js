const mongoose = require('mongoose');

// Schéma pour les paramètres de log individuels
const logSettingSchema = new mongoose.Schema({
  channelId: { type: String, default: null },
  enabled: { type: Boolean, default: true }
}, { _id: false });

const guildSettingsSchema = new mongoose.Schema(
  {
    guildId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true
    },
    xpEnabled: { type: Boolean, default: true },

    leveling: {
      channelId: { type: String, default: null },
      levelUpMessage: { type: String, default: '{user} a atteint le niveau {level} !' },
      xpPerMessage: {
        min: { type: Number, default: 5 },
        max: { type: Number, default: 10 },
      },
      cooldown: { type: Number, default: 60 },
      blacklistedChannels: { type: [String], default: [] },
      blacklistedRoles: { type: [String], default: [] },
    },

    welcomeChannelId: { type: String, default: null },
    statsChannelId: { 
      type: String, 
      default: null,
      description: "ID du salon vocal affichant les statistiques des membres"
    },
    
    moderation: {
      // Configuration globale des logs
      logChannelId: { type: String, default: null },  // Canal de logs global
      
      // Configuration des logs par type d'événement
      logSettings: {
        // Commandes de modération
        ban: { type: logSettingSchema, default: () => ({}) },
        unban: { type: logSettingSchema, default: () => ({}) },
        kick: { type: logSettingSchema, default: () => ({}) },
        mute: { type: logSettingSchema, default: () => ({}) },
        warn: { type: logSettingSchema, default: () => ({}) },
        purge: { type: logSettingSchema, default: () => ({}) },
        lock: { type: logSettingSchema, default: () => ({}) },
        unlock: { type: logSettingSchema, default: () => ({}) },
        slowmode: { type: logSettingSchema, default: () => ({}) },
        
        // Commandes temporaires
        tempmute: { type: logSettingSchema, default: () => ({}) },
        tempban: { type: logSettingSchema, default: () => ({}) },
        tempwarn: { type: logSettingSchema, default: () => ({}) },
        
        // Autres événements
        memberUpdate: { type: logSettingSchema, default: () => ({ enabled: false }) },
        messageDelete: { type: logSettingSchema, default: () => ({ enabled: false }) },
        messageUpdate: { type: logSettingSchema, default: () => ({ enabled: false }) },
        roleCreate: { type: logSettingSchema, default: () => ({}) },
        roleDelete: { type: logSettingSchema, default: () => ({}) },
        roleUpdate: { type: logSettingSchema, default: () => ({}) },
        channelCreate: { type: logSettingSchema, default: () => ({}) },
        channelDelete: { type: logSettingSchema, default: () => ({}) },
        channelUpdate: { type: logSettingSchema, default: () => ({}) }
      },
      
      // Rétrocompatibilité (à supprimer après migration si nécessaire)
      logBans: { type: Boolean, default: true },
      logKicks: { type: Boolean, default: true },
      logMutes: { type: Boolean, default: true },
      logWarnings: { type: Boolean, default: true },
      logPurges: { type: Boolean, default: true },
      logLocks: { type: Boolean, default: true },
      logSlowmode: { type: Boolean, default: true },
      logMemberUpdates: { type: Boolean, default: false },
      logMessageUpdates: { type: Boolean, default: false },
      logMessageDeletes: { type: Boolean, default: false },
      logRoleChanges: { type: Boolean, default: true },
      logChannelChanges: { type: Boolean, default: true }
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Si vous avez besoin d'un index composé à l'avenir, vous pouvez l'ajouter ici
// Exemple : guildSettingsSchema.index({ guildId: 1, 'moderation.logChannelId': 1 });

const GuildSettings = mongoose.model('GuildSettings', guildSettingsSchema);

module.exports = { GuildSettings };
