const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const GuildConfig = require('../../models/GuildConfig');
const { updateMemberCount } = require('../../utils/stats-vocal');

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

    // ---- AJOUTER le salon compteur ----
    if (action === 'add') {
      if (config?.memberCountChannelId) {
        return interaction.reply({
          content: '❌ Un salon compteur existe déjà sur ce serveur.',
          ephemeral: true,
        });
      }

      // Créer le salon vocal
      const channel = await guild.channels.create({
        name: `👥 Membres : ${guild.memberCount}`,
        type: ChannelType.GuildVoice,
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

      // Mettre à jour immédiatement le compteur (juste au cas où)
      await updateMemberCount(guild);

      return interaction.reply({
        content: `✅ Salon compteur créé : ${channel}`,
        ephemeral: true,
      });
    }

    // ---- SUPPRIMER le salon compteur ----
    if (action === 'remove') {
      if (!config?.memberCountChannelId) {
        return interaction.reply({
          content: '❌ Aucun salon compteur trouvé sur ce serveur.',
          ephemeral: true,
        });
      }

      const channel = guild.channels.cache.get(config.memberCountChannelId);
      if (channel) {
        try {
          await channel.delete();
        } catch (err) {
          console.error(err);
        }
      }

      await GuildConfig.deleteOne({ guildId: guild.id });

      return interaction.reply({
        content: '✅ Salon compteur supprimé et configuration effacée.',
        ephemeral: true,
      });
    }
  },
};
