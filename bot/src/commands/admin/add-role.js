const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('Ajoute un rôle à un membre')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à qui ajouter le rôle')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Le rôle à ajouter')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    const member = interaction.options.getMember('membre');
    const role = interaction.options.getRole('role');
    
    // Ne pas gérer la réponse ici, c'est déjà fait par interactionCreate.js
    
    try {
      // Vérifier si le membre a déjà le rôle
      if (member.roles.cache.has(role.id)) {
        return await interaction.editReply(`❌ ${member} a déjà le rôle ${role}.`);
      }

      // Ajouter le rôle
      await member.roles.add(role);

      // Essayer d'envoyer un DM
      try {
        await member.send(
          `✅ Le rôle ${role.name} vous a été ajouté avec succès sur ${interaction.guild.name} !`
        );
        await interaction.editReply(`✅ Le rôle ${role} a été ajouté à ${member} et un message privé a été envoyé.`);
      } catch (dmError) {
        console.error(`Impossible d'envoyer un DM à ${member.user.tag}:`, dmError);
        await interaction.editReply(`✅ Rôle ${role} ajouté à ${member}, mais impossible d'envoyer un message privé.`);
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout du rôle:", error);
      await interaction.editReply("❌ Une erreur est survenue lors de l'ajout du rôle.");
    }
  },
};
