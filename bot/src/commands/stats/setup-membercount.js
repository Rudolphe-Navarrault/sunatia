const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../../models/GuildConfig');
const { scheduleUpdate } = require('../../utils/stats-vocal');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-membercount')
    .setDescription('Créer ou supprimer un salon vocal affichant le nombre de membres')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('action')
        .setDescription('Ajouter ou supprimer le salon compteur')
        .setRequired(true)
        .addChoices({ name: 'Ajouter', value: 'add' }, { name: 'Supprimer', value: 'remove' })
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const action = interaction.options.getString('action');

    let config = await GuildConfig.findOne({ guildId: guild.id });

    if (action === 'add') {
      if (config && config.memberCountChannelId) {
        return interaction.reply({
          content: '❌ Un salon compteur existe déjà sur ce serveur.',
          ephemeral: true,
        });
      }

      const memberCount = guild.memberCount;
      const channel = await guild.channels.create({
        name: `👥 Membres : ${memberCount}`,
        type: 2, // voice
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: ['Connect'],
          },
        ],
      });

      if (!config) config = new GuildConfig({ guildId: guild.id });
      config.memberCountChannelId = channel.id;
      await config.save();

      scheduleUpdate(guild);

      return interaction.reply({
        content: `✅ Salon compteur créé : ${channel}`,
        ephemeral: true,
      });
    }

    if (action === 'remove') {
      if (!config || !config.memberCountChannelId) {
        return interaction.reply({
          content: '❌ Aucun salon compteur trouvé sur ce serveur.',
          ephemeral: true,
        });
      }

      try {
        const channel = guild.channels.cache.get(config.memberCountChannelId);
        if (channel) await channel.delete();
      } catch {}

      await GuildConfig.deleteOne({ guildId: guild.id });

      return interaction.reply({
        content: '✅ Salon compteur supprimé et configuration effacée.',
        ephemeral: true,
      });
    }
  },
};
