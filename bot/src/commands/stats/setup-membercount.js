const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../../models/GuildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-membercount')
    .setDescription('Créer un salon vocal affichant le nombre de membres du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guild = interaction.guild;

    // Vérifier si déjà configuré
    let config = await GuildConfig.findOne({ guildId: guild.id });
    if (config && config.memberCountChannelId) {
      return interaction.reply({
        content: '❌ Un salon compteur existe déjà sur ce serveur.',
        ephemeral: true,
      });
    }

    // Créer le salon vocal
    const memberCount = guild.memberCount;
    const channel = await guild.channels.create({
      name: `👥 Membres : ${memberCount}`,
      type: 2, // 2 = voice
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: ['Connect'], // empêche de rejoindre
        },
      ],
    });

    // Sauvegarder en DB
    if (!config) {
      config = new GuildConfig({ guildId: guild.id });
    }
    config.memberCountChannelId = channel.id;
    await config.save();

    return interaction.reply({
      content: `✅ Salon compteur créé : ${channel}`,
      ephemeral: true,
    });
  },
};
