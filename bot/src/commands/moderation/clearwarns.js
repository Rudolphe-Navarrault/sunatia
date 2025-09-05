const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Warning = require('../../models/Warning');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('Efface les avertissements d\'un membre')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre dont vous voulez effacer les avertissements')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre d\'avertissements à effacer (laissez vide pour tout effacer)')
        .setMinValue(1)
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison de la suppression des avertissements')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    const count = interaction.options.getInteger('nombre');
    const reason = interaction.options.getString('raison') || 'Aucune raison fournie';
    const { user } = interaction;

    // Vérifications de base
    if (member.id === user.id) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas effacer vos propres avertissements !',
        ephemeral: true
      });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content: '❌ Vous ne pouvez pas effacer les avertissements d\'un membre avec un rôle supérieur ou égal au vôtre.',
        ephemeral: true
      });
    }

    try {
      // Récupérer les avertissements actifs
      const query = {
        userId: member.id,
        guildId: interaction.guildId,
        active: true
      };

      const activeWarnings = await Warning.find(query).sort({ createdAt: -1 });
      
      if (activeWarnings.length === 0) {
        return interaction.reply({
          content: `❌ ${member.user.tag} n'a aucun avertissement actif.`,
          ephemeral: true
        });
      }

      // Déterminer combien d'avertissements effacer
      const warningsToClear = count ? Math.min(count, activeWarnings.length) : activeWarnings.length;
      const warningsToDeactivate = activeWarnings.slice(0, warningsToClear);

      // Désactiver les avertissements
      const warningIds = warningsToDeactivate.map(w => w._id);
      
      const result = await Warning.updateMany(
        { _id: { $in: warningIds } },
        { 
          $set: { 
            active: false,
            'metadata.clearedBy': user.id,
            'metadata.clearedAt': new Date(),
            'metadata.clearReason': reason
          } 
        }
      );

      if (result.modifiedCount === 0) {
        throw new Error('Aucun avertissement n\'a pu être effacé');
      }

      // Créer l'embed de confirmation
      const embed = new EmbedBuilder()
        .setColor('#4CAF50')
        .setTitle('✅ Avertissements effacés')
        .setDescription(`**${result.modifiedCount}** avertissement(s) ont été effacés pour ${member.user.tag}`)
        .addFields(
          { name: 'Modérateur', value: user.tag, inline: true },
          { name: 'Raison', value: reason, inline: true }
        )
        .setTimestamp();

      // Envoyer la confirmation
      await interaction.reply({ 
        embeds: [embed],
        ephemeral: true 
      });

      // Envoyer un message au membre
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#4CAF50')
          .setTitle('✅ Avertissements effacés')
          .setDescription(`Vos avertissements sur **${interaction.guild.name}** ont été effacés par un modérateur.`)
          .addFields(
            { name: 'Nombre d\'avertissements effacés', value: result.modifiedCount.toString(), inline: true },
            { name: 'Raison', value: reason, inline: true }
          )
          .setFooter({ text: 'Merci de respecter les règles du serveur' })
          .setTimestamp();

        await member.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        logger.warn(`Impossible d'envoyer un message privé à ${member.user.tag} pour la suppression des avertissements`);
      }

      // Logger l'action
      logger.info(`[Modération] ${user.tag} (${user.id}) a effacé ${result.modifiedCount} avertissement(s) de ${member.user.tag} (${member.id}). Raison: ${reason}`);

    } catch (error) {
      logger.error('Erreur lors de la suppression des avertissements:', error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de la suppression des avertissements.',
        ephemeral: true
      });
    }
  }
};
