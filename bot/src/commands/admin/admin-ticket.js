// commands/admin/admin-ticket.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const TicketSetup = require('../../models/TicketSetup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-ticket')
    .setDescription('Setup du système de ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.channel;
    const guild = interaction.guild;

    // Dropdown pour raison du ticket
    const reasonMenu = new StringSelectMenuBuilder()
      .setCustomId('ticket_reason_select')
      .setPlaceholder('Choisissez la raison du ticket')
      .addOptions([
        { label: 'Support général', value: 'support' },
        { label: 'Bug / problème', value: 'bug' },
        { label: 'Suggestion', value: 'suggestion' },
        { label: 'Autre', value: 'other' },
      ]);

    // Bouton pour créer le ticket
    const openButton = new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel('📝 Ouvrir un ticket')
      .setStyle(ButtonStyle.Primary);

    const rowButtons = new ActionRowBuilder().addComponents(openButton);
    const rowMenu = new ActionRowBuilder().addComponents(reasonMenu);

    const msg = await channel.send({
      content: `🎟️ **Sunatia Studios - Support**
    
    💡 **Avant d'ouvrir un ticket :**
    • Vérifiez le salon ⁠❓・questions-fr pour voir si votre question a déjà une réponse.
    • Demandez de l'aide à la communauté dans ⁠🙏・entraide.
    
    🐛 **Bugs ou suggestions :**
    • Signalez un bug dans ⁠🐛・bugs.
    • Partagez vos idées ou suggestions dans ⁠💡・suggestions.
    
    🛠️ **Pour contacter le support :**
    Cliquez sur un des boutons ci-dessous ou choisissez la raison du ticket dans le menu déroulant.
    Un ticket sera automatiquement créé dans la catégorie dédiée, et un membre du support vous répondra rapidement !
    
    ⚠️ **Note :**
    Merci de ne pas mentionner le staff inutilement et de ne pas partager vos informations personnelles dans le ticket.`,

      components: [rowMenu, rowButtons],
    });

    // Enregistrement setup
    await TicketSetup.findOneAndUpdate(
      { guildId: guild.id },
      { guildId: guild.id, channelId: channel.id, messageId: msg.id },
      { upsert: true }
    );

    return interaction.reply({ content: '✅ Message de ticket configuré.', ephemeral: true });
  },
};
