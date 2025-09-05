const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('Ajoute un rôle à un membre')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre à qui ajouter le rôle').setRequired(true)
    )
    .addRoleOption((option) =>
      option.setName('role').setDescription('Le rôle à ajouter').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    const role = interaction.options.getRole('role');
    const botMember = interaction.guild.members.me;

    try {
      // Vérifier si le rôle est supérieur ou égal au rôle du bot
      if (role.position >= botMember.roles.highest.position) {
        return await interaction.reply({
          content:
            '❌ Je ne peux pas gérer ce rôle car il est supérieur ou égal à mon rôle le plus élevé.',
          ephemeral: true,
        });
      }

      // Vérifier si le membre a déjà le rôle
      if (member.roles.cache.has(role.id)) {
        return await interaction.reply({
          content: `❌ ${member} a déjà le rôle ${role}.`,
          ephemeral: true,
        });
      }

      // Ajouter le rôle
      await member.roles.add(role);

      // Essayer d'envoyer un DM
      try {
        await member.send(
          `✅ Le rôle ${role.name} vous a été ajouté avec succès sur ${interaction.guild.name} !`
        );
        return await interaction.reply({
          content: `✅ Le rôle ${role} a été ajouté à ${member} et un message privé a été envoyé.`,
          ephemeral: true,
        });
      } catch (dmError) {
        console.error(`Impossible d'envoyer un DM à ${member.user.tag}:`, dmError);
        return await interaction.reply({
          content: `✅ Rôle ${role} ajouté à ${member}, mais impossible d'envoyer un message privé.`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error('❌ Erreur dans la commande add-role:', error);
      return await interaction.reply({
        content: "❌ Une erreur est survenue lors de l'ajout du rôle.",
        ephemeral: true,
      });
    }
  },
};
