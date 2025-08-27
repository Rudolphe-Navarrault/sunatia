const mongoose = require("mongoose");
const cache = require("../utils/cache");

const xpSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    lastXpGain: { type: Date, default: Date.now },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map(),
    },
  },
  { timestamps: true }
);

xpSchema.index({ userId: 1, guildId: 1 }, { unique: true });
xpSchema.index({ guildId: 1, xp: -1 });

// Calcule le niveau en fonction de l'XP
function calculateLevel(xp) {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const xpForNextLevel = Math.pow(level * 10, 2);
  const xpForCurrentLevel = level > 1 ? Math.pow((level - 1) * 10, 2) : 0;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const xpProgress = xp - xpForCurrentLevel;
  return {
    level,
    xpForNextLevel,
    xpNeeded,
    xpProgress,
    progressPercentage: Math.min(
      Math.round((xpProgress / xpNeeded) * 100),
      100
    ),
  };
}

// Middleware pour logger et mettre à jour le cache
xpSchema.pre("save", function (next) {
  cache.set(this.guildId, this.userId, this);
  next();
});

// Méthode d’instance
xpSchema.methods.getLevelInfo = function () {
  return calculateLevel(this.xp);
};

// Méthodes statiques
xpSchema.statics.clearGuildData = function (guildId) {
  return this.deleteMany({ guildId });
};

// Change Stream pour mise à jour dynamique du cache
xpSchema.statics.initChangeStream = function () {
  const changeStream = this.watch([], { fullDocument: "updateLookup" });
  changeStream.on("change", (change) => {
    if (change.fullDocument) {
      cache.set(
        change.fullDocument.guildId,
        change.fullDocument.userId,
        change.fullDocument
      );
      console.log(
        `[XP] Cache mis à jour pour ${change.fullDocument.userId} dans ${change.fullDocument.guildId}`
      );
    }
  });
};

module.exports = mongoose.model("XP", xpSchema);
