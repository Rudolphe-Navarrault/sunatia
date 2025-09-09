const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../../models/GuildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-membercount')
    .setDescription('Gérer le salon compteur de membres')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Créer un salon vocal affichant le nombre de membres du serveur')
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Supprimer le salon compteur de membres existant')
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    let config = await GuildConfig.findOne({ guildId: guild.id });

    if (subcommand === 'add') {
      // Vérifier si déjà configuré
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
        type: 2, // salon vocal
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
    }

    if (subcommand === 'remove') {
      // Vérifier si configuré
      if (!config || !config.memberCountChannelId) {
        return interaction.reply({
          content: '❌ Aucun salon compteur n’est configuré sur ce serveur.',
          ephemeral: true,
        });
      }

      try {
        const channel = guild.channels.cache.get(config.memberCountChannelId);
        if (channel) await channel.delete();

        // Supprimer de la DB
        config.memberCountChannelId = null;
        await config.save();

        return interaction.reply({
          content: '✅ Salon compteur supprimé avec succès.',
          ephemeral: true,
        });
      } catch (err) {
        console.error('❌ Erreur suppression salon compteur:', err);
        return interaction.reply({
          content: '❌ Impossible de supprimer le salon compteur.',
          ephemeral: true,
        });
      }
    }
  },
};
