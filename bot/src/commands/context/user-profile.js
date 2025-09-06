const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { formatDate } = require('../../utils/format');
const User = require('../../models/User');

// Création de la commande
const command = new ContextMenuCommandBuilder()
  .setName('Afficher le profil')
  .setType(ApplicationCommandType.User)
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewChannel);

module.exports = {
  // Configuration de la commande de menu contextuel
  data: command,

  // Fonction d'exécution de la commande
  async execute(interaction) {
    try {
      // Récupérer l'utilisateur ciblé
      const targetMember = interaction.targetMember;
      const targetUser = interaction.targetUser;
      const guild = interaction.guild;

      // Vérifier si le membre est sur le serveur
      if (!targetMember) {
        return interaction.reply({
          content: "❌ Cet utilisateur n'est pas sur ce serveur.",
          ephemeral: true
        });
      }
      
      // Récupérer les informations de l'utilisateur depuis la base de données
      const userData = await User.findOrCreate({
        userId: targetUser.id,
        guildId: guild.id,
        username: targetUser.username,
        discriminator: targetUser.discriminator,
        bot: targetUser.bot
      });

      // Formater la date de création du compte
      const accountCreated = formatDate(targetUser.createdAt);
      // Formater la date d'arrivée sur le serveur
      const joinedAt = targetMember.joinedAt ? formatDate(targetMember.joinedAt) : 'Inconnue';
      // Récupérer la localité
      const location = userData.getLocation();

      // Créer l'embed du profil
      const profileEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({
          name: `Profil de ${targetUser.username}`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true })
        })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription('\u200b')
        .addFields(
          {
            name: 'Localité',
            value: location,
            inline: true
          },
          {
            name: 'Anniversaire',
            value: 'Non précisée',
            inline: true
          },
          {
            name: 'Jeux (gameprofil)',
            value: 'Aucun profil de jeu enregistré.',
            inline: false
          },
          {
            name: '\nCréation du compte',
            value: accountCreated,
            inline: true
          },
          {
            name: '\nDate d\'arrivée',
            value: joinedAt,
            inline: true
          }
        )
        .setFooter({
          text: `ID: ${targetUser.id}`,
          iconURL: guild.iconURL()
        });

      // Ajouter un badge si l'utilisateur est un bot
      if (targetUser.bot) {
        profileEmbed.addFields({
          name: '🤖',
          value: 'Cet utilisateur est un bot',
          inline: false
        });
      }

      // Répondre avec l'embed
      await interaction.reply({
        embeds: [profileEmbed],
        ephemeral: true
      });

    } catch (error) {
      console.error('Erreur lors de l\'affichage du profil:', error);
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de l\'affichage du profil.',
          ephemeral: true
        });
      }
    }
  },

  // Fonction utilitaire pour formater les rôles
  formatRoles(member) {
    const roles = member.roles.cache
      .sort((a, b) => b.position - a.position)
      .filter(role => role.id !== member.guild.roles.everyone.id)
      .map(role => role);

    if (roles.length === 0) return 'Aucun rôle';
    
    // Limiter à 5 rôles pour éviter que l'embed ne soit trop long
    const displayedRoles = roles.slice(0, 5);
    const remainingRoles = roles.length - displayedRoles.length;
    
    let rolesText = displayedRoles.map(role => role.toString()).join(' ');
    
    if (remainingRoles > 0) {
      rolesText += ` et ${remainingRoles} autre${remainingRoles > 1 ? 's' : ''}`;
    }
    
    return rolesText;
  }
};
