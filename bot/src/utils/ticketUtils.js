const { PermissionsBitField } = require('discord.js');
const Ticket = require('../models/Ticket');

async function createTicketChannel(guild, member, reason, categoryId) {
  const channel = await guild.channels.create({
    name: `🟢-ticket-${member.user.username}`,
    type: 0, // GUILD_TEXT
    parent: categoryId,
    permissionOverwrites: [
      { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
      {
        id: member.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
      },
    ],
  });

  await Ticket.create({
    guildId: guild.id,
    channelId: channel.id,
    userId: member.id,
    reason,
    status: 'open',
  });

  await channel.send(`🎫 Ticket ouvert par ${member} pour : ${reason}`);
  return channel;
}

async function setTicketStatus(channel, status) {
  const emojiMap = { open: '🟢', paused: '🟡', closed: '🔴', archived: '📦' };
  const ticket = await Ticket.findOne({ channelId: channel.id });
  if (!ticket) throw new Error('Ticket non trouvé en base.');

  ticket.status = status;
  await ticket.save();

  // Renommer le salon
  const baseName = channel.name.replace(/^🟢|🟡|🔴|📦-/, '');
  await channel.setName(`${emojiMap[status]}-${baseName}`);
}

async function addMember(channel, userId) {
  await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true });
  const ticket = await Ticket.findOne({ channelId: channel.id });
  if (!ticket) throw new Error('Ticket non trouvé.');
  if (!ticket.staff.includes(userId)) ticket.staff.push(userId);
  await ticket.save();
}

async function removeMember(channel, userId) {
  await channel.permissionOverwrites.edit(userId, { ViewChannel: false, SendMessages: false });
  const ticket = await Ticket.findOne({ channelId: channel.id });
  if (!ticket) throw new Error('Ticket non trouvé.');
  ticket.staff = ticket.staff.filter((id) => id !== userId);
  await ticket.save();
}

async function archiveTicket(channel, archiveCategoryId) {
  await setTicketStatus(channel, 'archived');
  await channel.setParent(archiveCategoryId);
  await channel.permissionOverwrites.set([]); // lecture seule par défaut
}

module.exports = { createTicketChannel, setTicketStatus, addMember, removeMember, archiveTicket };
