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
      content: `**Sunatia - Support**
Avant d'ouvrir un ticket:
• Jetez un coup d'œil dans ⁠❓・questions-fr !
• Demandez aux joueurs dans ⁠🙏・entraide !

Un bug ou une suggestion ?
• Utilisez les salons ⁠💡・suggestions ou ⁠🐛・bugs !

Pour contacter le support cliquez sur un des boutons ci-dessous !
Un ticket sera automatiquement créé dans une section située au dessus !`,
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
