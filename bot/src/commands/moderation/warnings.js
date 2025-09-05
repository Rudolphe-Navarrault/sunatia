const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Warning = require('../../models/Warning');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Affiche les avertissements d\'un membre')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre dont vous voulez voir les avertissements')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    
    try {
      // Récupérer les avertissements actifs du membre
      const warnings = await Warning.find({
        userId: member.id,
        guildId: interaction.guildId,
        $or: [
          { active: true, expiresAt: null },
          { active: true, expiresAt: { $gt: new Date() } }
        ]
      }).sort({ createdAt: -1 });

      // Récupérer le total des points d'avertissement
      const totalPoints = await Warning.aggregate([
        {
          $match: {
            userId: member.id,
            guildId: interaction.guildId,
            $or: [
              { active: true, expiresAt: null },
              { active: true, expiresAt: { $gt: new Date() } }
            ]
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$points' }
          }
        }
      ]);

      const totalPointsCount = totalPoints[0]?.total || 0;

      // Créer l'embed
      const embed = new EmbedBuilder()
        .setColor('#ffcc00')
        .setTitle(`⚠️ Avertissements de ${member.user.tag}`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { 
            name: '📊 Points totaux', 
            value: `**${totalPointsCount}** points d'avertissement actifs`,
            inline: true 
          },
          { 
            name: '📝 Avertissements actifs', 
            value: `**${warnings.length}** avertissement(s) en cours`,
            inline: true 
          }
        )
        .setFooter({ text: `ID: ${member.id}` })
        .setTimestamp();

      // Ajouter chaque avertissement comme un champ séparé
      if (warnings.length > 0) {
        const warningsList = warnings.map((warn, index) => {
          const date = `<t:${Math.floor(warn.createdAt.getTime() / 1000)}:R>`;
          const expires = warn.expiresAt 
            ? `Expire <t:${Math.floor(warn.expiresAt.getTime() / 1000)}:R>` 
            : 'N\'expire pas';
          
          return `**#${index + 1}** - ${warn.points} point(s) - ${date}\n` +
                 `**Raison:** ${warn.reason}\n` +
                 `**Par:** <@${warn.moderatorId}> | ${expires}\n`;
        });

        // Diviser en plusieurs champs si nécessaire (limite de 1024 caractères par champ)
        let currentField = '';
        const fields = [];
        
        for (const warning of warningsList) {
          if ((currentField + warning).length > 1024) {
            fields.push({ name: '\u200B', value: currentField, inline: false });
            currentField = warning;
          } else {
            currentField += (currentField ? '\n\n' : '') + warning;
          }
        }
        
        if (currentField) {
          fields.push({ name: '\u200B', value: currentField, inline: false });
        }

        // Ajouter les champs à l'embed
        for (const field of fields) {
          embed.addFields(field);
        }
      } else {
        embed.setDescription('Aucun avertissement actif pour ce membre.');
      }

      // Envoyer la réponse
      await interaction.reply({ 
        embeds: [embed],
        ephemeral: true 
      });

    } catch (error) {
      logger.error('Erreur lors de la récupération des avertissements:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la récupération des avertissements.',
        ephemeral: true
      });
    }
  }
};
