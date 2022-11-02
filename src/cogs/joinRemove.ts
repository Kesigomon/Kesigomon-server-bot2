import {client} from '../index';
import {leaveLogChannelId} from '../constant';
import {Collection, Invite, TextChannel} from 'discord.js';
import {userMention} from '@discordjs/builders';

let oldInvite = new Collection<string, Invite>();

client.on('ready', async(client) => {
  const guild = client.guilds.cache.first()!
  oldInvite = guild.invites.cache.clone();

})

client.on('guildMemberAdd', async (member) => {
  const channel = await client.channels.fetch(leaveLogChannelId)
  if (!(channel instanceof TextChannel)){
    return
  }
  const newInvite = await member.guild.invites.fetch({cache: false});
  for (const [id, invite] of newInvite.entries()) {
    const srcInvite = newInvite.get(id)
    if(!srcInvite || srcInvite.uses !== invite.uses){
      const mention = invite.inviterId
          ? `\nInviter:${userMention(invite.inviterId)}`
          : ""
      await channel.send(
          `Code:${invite.code}${mention}`
      )
      break
    }
  }
  oldInvite = newInvite
})

client.on('guildMemberRemove', async (member) => {
  const channel = await client.channels.fetch(leaveLogChannelId)
  if (!(channel instanceof TextChannel)){
    return
  }
  await channel.send(`${userMention(member.id)}(${member.displayName})が退出しました`)
})