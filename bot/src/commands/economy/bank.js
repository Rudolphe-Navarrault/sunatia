const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const BankAccount = require('../../models/BankAccount');
const Coins = require('../../models/Coins');

const BANK_HELP_PAGES = [
  {
    title: '🏦 Sunatia Bank - Page 1',
    description: `
**Commandes :**
• /bank create <nom> <type> - Créer un compte bancaire.
• /bank display - Afficher vos comptes.
• /bank deposit <montant> - Déposer de l'argent.
• /bank withdraw <montant> - Retirer de l'argent.
• /bank transfer <iban> <montant> - Transférer de l'argent.
• /bank list - Lister tous les comptes du serveur.
• /bank help - Afficher cette aide.
    `,
  },
  {
    title: '💰 Types de comptes - Page 2',
    description: `
**courant**
- Accès facile, peu ou pas d'intérêts
- Frais faibles

**épargne**
- Intérêts plus élevés
- Frais de retrait plus importants

**investissement**
- Rendement aléatoire plus élevé
- Risque plus important
    `,
  },
  {
    title: '💳 Transferts & IBAN - Page 3',
    description: `
- Chaque compte possède un IBAN unique (ex: FR123456...)
- Vous pouvez transférer de l'argent à un autre compte en utilisant son IBAN
- Pour recevoir un virement, communiquez simplement votre IBAN
    `,
  },
  {
    title: '💸 Intérêts & frais - Page 4',
    description: `
- Les comptes Épargne et Investissement génèrent des intérêts périodiques
- Des frais peuvent être appliqués chaque mois
- Les intérêts et frais sont calculés automatiquement par le cron job
- Exemple :
  • épargne : +2% / mois, frais 1%
  • courant : +0%, frais 0.5%
  • investissement : +0-5% aléatoire, frais 2%
    `,
  },
];

const helpCache = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bank')
    .setDescription('Gestion des comptes bancaires')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Créer un compte bancaire')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Nom du compte').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Type de compte')
            .setRequired(true)
            .addChoices(
              { name: 'courant', value: 'courant' },
              { name: 'épargne', value: 'épargne' },
              { name: 'investissement', value: 'investissement' }
            )
        )
    )
    .addSubcommand((sub) => sub.setName('display').setDescription('Afficher vos comptes bancaires'))
    .addSubcommand((sub) =>
      sub
        .setName('deposit')
        .setDescription('Déposer de l’argent dans un compte')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Nom du compte').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Montant').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('withdraw')
        .setDescription('Retirer de l’argent d’un compte')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Nom du compte').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Montant').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('transfer')
        .setDescription('Transférer de l’argent vers un autre compte via IBAN')
        .addStringOption((opt) =>
          opt.setName('iban').setDescription('IBAN du destinataire').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Montant à transférer').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Lister tous les comptes du serveur')
    )
    .addSubcommand((sub) => sub.setName('help').setDescription('Afficher l’aide bancaire')),

  async execute(interaction) {
    await interaction.deferReply({ flags: 1 << 6 });
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    try {
      // ------------------- BANK CREATE -------------------
      if (sub === 'create') {
        const name = interaction.options.getString('name');
        const type = interaction.options.getString('type');

        const existing = await BankAccount.findOne({ guildId, name });
        if (existing) {
          if (existing.userId === userId)
            return interaction.editReply({
              content: '⚠️ Vous avez déjà créé ce compte bancaire.',
            });
          return interaction.editReply({ content: '❌ Ce nom de compte est déjà pris.' });
        }

        const account = await BankAccount.create({ userId, guildId, name, type });
        return interaction.editReply({
          content: `✅ Compte **${name}** (${type}) créé avec succès ! IBAN: \`${account.iban}\``,
        });
      }

      // ------------------- BANK DISPLAY -------------------
      if (sub === 'display') {
        const accounts = await BankAccount.find({ userId, guildId });
        if (!accounts.length)
          return interaction.editReply({ content: '❌ Vous n’avez aucun compte.' });

        const embed = new EmbedBuilder()
          .setTitle('🏦 Vos comptes bancaires')
          .setColor('#00BFFF')
          .setDescription(
            accounts
              .map(
                (acc) =>
                  `• **${acc.name}** (${acc.type}) - 💰 ${acc.balance.toLocaleString()} • IBAN: \`${acc.iban}\``
              )
              .join('\n')
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ------------------- BANK DEPOSIT -------------------
      if (sub === 'deposit') {
        const name = interaction.options.getString('name');
        const amount = interaction.options.getInteger('amount');

        if (amount <= 0)
          return interaction.editReply({ content: '❌ Le montant doit être supérieur à 0.' });

        const account = await BankAccount.findOne({ userId, guildId, name });
        if (!account) return interaction.editReply({ content: '❌ Compte introuvable.' });

        const coins = await Coins.findOrCreate({ userId, guildId });
        if (coins.balance < amount)
          return interaction.editReply({
            content: '❌ Vous n’avez pas assez de pièces pour ce dépôt.',
          });

        account.balance += amount;
        account.totalDeposited += amount;
        await account.save();

        await coins.addCoins(-amount); // retirer les coins

        return interaction.editReply({
          content: `✅ Vous avez déposé ${amount.toLocaleString()} dans **${name}**. Nouveau solde: ${account.balance.toLocaleString()}`,
        });
      }

      // ------------------- BANK WITHDRAW -------------------
      if (sub === 'withdraw') {
        const name = interaction.options.getString('name');
        const amount = interaction.options.getInteger('amount');

        if (amount <= 0)
          return interaction.editReply({ content: '❌ Le montant doit être supérieur à 0.' });

        const account = await BankAccount.findOne({ userId, guildId, name });
        if (!account) return interaction.editReply({ content: '❌ Compte introuvable.' });

        if (account.balance < amount)
          return interaction.editReply({ content: '❌ Solde insuffisant sur le compte bancaire.' });

        const coins = await Coins.findOrCreate({ userId, guildId });

        account.balance -= amount;
        await account.save();

        await coins.addCoins(amount); // ajouter les coins

        return interaction.editReply({
          content: `✅ Vous avez retiré ${amount.toLocaleString()} de **${name}**. Nouveau solde Coins: ${coins.balance.toLocaleString()}`,
        });
      }

      // ------------------- BANK TRANSFER -------------------
      if (sub === 'transfer') {
        const iban = interaction.options.getString('iban').toUpperCase();
        const amount = interaction.options.getInteger('amount');

        if (amount <= 0)
          return interaction.editReply({ content: '❌ Le montant doit être supérieur à 0.' });

        const sender = await BankAccount.findOne({ userId, guildId, balance: { $gte: amount } });
        if (!sender)
          return interaction.editReply({ content: '❌ Solde insuffisant sur le compte.' });

        const receiver = await BankAccount.findOne({ iban });
        if (!receiver) return interaction.editReply({ content: '❌ IBAN introuvable.' });

        sender.balance -= amount;
        receiver.balance += amount;

        await sender.save();
        await receiver.save();

        return interaction.editReply({
          content: `✅ Transfert de ${amount.toLocaleString()} de **${sender.name}** vers **${receiver.name}** réussi !`,
        });
      }

      // ------------------- BANK LIST -------------------
      if (sub === 'list') {
        const accounts = await BankAccount.find({ guildId });
        if (!accounts.length)
          return interaction.editReply({ content: '❌ Aucun compte trouvé sur ce serveur.' });

        const embed = new EmbedBuilder()
          .setTitle('🏦 Comptes du serveur')
          .setColor('#00BFFF')
          .setDescription(
            accounts
              .map(
                (acc) =>
                  `• **${acc.name}** (${acc.type}) - 💰 ${acc.balance.toLocaleString()} • IBAN: \`${acc.iban}\``
              )
              .join('\n')
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      // ------------------- BANK HELP -------------------
      if (sub === 'help') {
        let page = 0;

        const generateEmbed = (pageIndex) => {
          const pageData = BANK_HELP_PAGES[pageIndex];
          return new EmbedBuilder()
            .setTitle(pageData.title)
            .setDescription(pageData.description)
            .setColor('#00BFFF')
            .setFooter({ text: `Page ${pageIndex + 1}/${BANK_HELP_PAGES.length}` })
            .setTimestamp();
        };

        const generateButtons = (pageIndex) => {
          return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('help_prev')
              .setLabel('◀️ Précédent')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(pageIndex === 0),
            new ButtonBuilder()
              .setCustomId('help_next')
              .setLabel('Suivant ▶️')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(pageIndex === BANK_HELP_PAGES.length - 1)
          );
        };

        const message = await interaction.editReply({
          embeds: [generateEmbed(page)],
          components: [generateButtons(page)],
        });

        helpCache.set(interaction.user.id, { messageId: message.id, page });
        return;
      }
    } catch (err) {
      console.error('❌ Erreur commande bank:', err);
      return interaction.editReply({ content: '❌ Une erreur est survenue.' });
    }
  },

  async handleButton(interaction) {
    if (!interaction.isButton()) return;
    if (!helpCache.has(interaction.user.id)) return;

    const state = helpCache.get(interaction.user.id);
    if (interaction.message.id !== state.messageId) return;

    const BANK_HELP_PAGES_COUNT = BANK_HELP_PAGES.length;

    if (interaction.customId === 'help_prev') state.page = Math.max(0, state.page - 1);
    if (interaction.customId === 'help_next')
      state.page = Math.min(BANK_HELP_PAGES_COUNT - 1, state.page + 1);

    const generateEmbed = (pageIndex) => {
      const pageData = BANK_HELP_PAGES[pageIndex];
      return new EmbedBuilder()
        .setTitle(pageData.title)
        .setDescription(pageData.description)
        .setColor('#00BFFF')
        .setFooter({ text: `Page ${pageIndex + 1}/${BANK_HELP_PAGES_COUNT}` })
        .setTimestamp();
    };

    const generateButtons = (pageIndex) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('help_prev')
          .setLabel('◀️ Précédent')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === 0),
        new ButtonBuilder()
          .setCustomId('help_next')
          .setLabel('Suivant ▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pageIndex === BANK_HELP_PAGES_COUNT - 1)
      );
    };

    await interaction.update({
      embeds: [generateEmbed(state.page)],
      components: [generateButtons(state.page)],
    });

    helpCache.set(interaction.user.id, state);
  },
};
