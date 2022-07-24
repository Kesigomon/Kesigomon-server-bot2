import AsyncLock from 'async-lock';
import {GuildMember, MessageEmbed, TextChannel} from 'discord.js';
import {client} from '../index';
import {joinLogChannelId, normalUserRoleId} from '../constant';
import {memberNicknameMention} from '@discordjs/builders';

const lock = new AsyncLock();

const isAuthorizeable = (member: GuildMember) => {
    return !member.pending && member.roles.cache.size === 1
};

const authorize = async (members: Array<GuildMember>) => {
    if (members.length === 0){
        return
    }
    await Promise.all(members.map((m) => m.roles.add(normalUserRoleId)));
    const channel = await members[0].guild.channels.fetch(joinLogChannelId)
    if (!(channel instanceof TextChannel)){
        return
    }
    const embed = new MessageEmbed();
    const mentions = members
        .map((m) => `${memberNicknameMention(m.id)}さん`)
        .join();
    embed.setDescription(`${mentions}さんの認証が完了しました。`)
    embed.setColor('GREEN');
    await channel.send({embeds: [embed]})
};

client.on('guildMemberUpdate', async(before, after) => {
    const isOwner = after.id === after.guild.ownerId;
    await lock.acquire('authorize', async ()=>{
        if (
            isOwner
            && before.presence?.status !== after.presence?.status
            && after.presence?.status === 'online'
        ){
            await authorize(Array.from(after.guild.members.cache.filter(isAuthorizeable).values()))
        }
        else if (!isOwner && isAuthorizeable(after) && before.pending){
            if ((await after.guild.fetchOwner()).presence?.status === 'online'){
                await authorize([after]);
            }
            else{
                // Todo: 仮認証完了
            }
        }
    })
});