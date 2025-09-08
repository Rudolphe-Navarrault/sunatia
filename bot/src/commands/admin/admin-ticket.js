const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const TicketConfig = require('../../models/TicketConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-ticket')
    .setDescription('Configurer le système de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Configurer le système de tickets')
        .addChannelOption((opt) =>
          opt
            .setName('categorie')
            .setDescription('Catégorie des tickets')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt.setName('staffrole').setDescription('Rôle du staff').setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('salon')
            .setDescription('Salon de setup')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') {
      const category = interaction.options.getChannel('categorie');
      const staffRole = interaction.options.getRole('staffrole');
      const setupChannel = interaction.options.getChannel('salon');

      const rowMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_reason')
          .setPlaceholder('Choisissez la raison du ticket')
          .addOptions([
            { label: 'Support', value: 'support' },
            { label: 'Bug', value: 'bug' },
            { label: 'Suggestion', value: 'suggestion' },
            { label: 'Autre', value: 'autre' },
          ])
      );

      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_create')
          .setLabel('🎫 Ouvrir un ticket')
          .setStyle(ButtonStyle.Success)
      );

      const msg = await setupChannel.send({
        content: `**${interaction.guild.name} - Support**
Avant d'ouvrir un ticket:
• Veuillez voir si vos réponses ne sont pas déjà répondues.
• Utilisez le salon Entraide.

➡️ Sélectionnez une raison puis cliquez sur le bouton ci-dessous.
Votre ticket sera créé dans **${category.name}**.`,
        components: [rowMenu, rowButtons],
      });

      await TicketConfig.findOneAndUpdate(
        { guildId: interaction.guild.id },
        {
          guildId: interaction.guild.id,
          categoryId: category.id,
          staffRoleId: staffRole.id,
          setupChannelId: setupChannel.id,
          setupMessageId: msg.id,
        },
        { upsert: true }
      );

      return interaction.reply({
        content: '✅ Système de tickets configuré avec succès.',
        ephemeral: true,
      });
    }
  },
};
