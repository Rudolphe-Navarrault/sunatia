const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { formatDate, formatRelativeTime } = require('../../utils/format');

// Création de la commande
const command = new ContextMenuCommandBuilder()
  .setName('Afficher les informations')
  .setType(ApplicationCommandType.User)
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewChannel);

module.exports = {
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
          ephemeral: true,
        });
      }

      // Formater les rôles (exclure @everyone et limiter à 5 rôles)
      const roles = targetMember.roles.cache
        .sort((a, b) => b.position - a.position)
        .filter((role) => role.id !== guild.roles.everyone.id)
        .map((role) => role.toString())
        .slice(0, 5);

      // Créer l'embed
      const infoEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({
          name: `Informations sur ${targetUser.username}`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true }),
        })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .setDescription(`Voici les informations concernant l'utilisateur ${targetUser.tag}.`)
        .addFields(
          {
            name: 'Mention',
            value: targetUser.toString(),
            inline: true,
          },
          {
            name: 'Identifiant',
            value: `\`${targetUser.id}\``,
            inline: true,
          },
          {
            name: `Rôles [${roles.length}]`,
            value: roles.length > 0 ? roles.join(', ') : 'Aucun rôle',
            inline: false,
          },
          {
            name: 'Création du compte',
            value: `${formatDate(targetUser.createdAt)}\n➜ ${formatRelativeTime(targetUser.createdAt)}`,
            inline: false,
          }
        );

      // Ajouter la date d'arrivée sur le serveur si disponible
      if (targetMember.joinedAt) {
        infoEmbed.addFields({
          name: "Date d'arrivée",
          value: `${formatDate(targetMember.joinedAt)}\n➜ ${formatRelativeTime(targetMember.joinedAt)}`,
          inline: false,
        });
      }

      // Afficher si c'est un bot
      if (targetUser.bot) {
        infoEmbed.addFields({
          name: 'Type de compte',
          value: '🤖 Compte bot',
          inline: true,
        });
      }

      // Répondre avec l'embed
      await interaction.reply({
        embeds: [infoEmbed],
        ephemeral: true,
      });
    } catch (error) {
      console.error('Erreur dans la commande Informations:', error);
      if (!interaction.replied) {
        await interaction.reply({
          content: '❌ Une erreur est survenue lors de la récupération des informations.',
          ephemeral: true,
        });
      }
    }
  },
};
