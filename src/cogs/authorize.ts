import AsyncLock from 'async-lock';
import {GuildMember, MessageEmbed, TextChannel} from 'discord.js';
import {client} from '../index';
import {joinLogChannelId, normalUserRoleId} from '../constant';
import {memberNicknameMention} from '@discordjs/builders';

const lock = new AsyncLock();
const AUTHORIZE = 'authorize';

const isAuthorizeable = (member: GuildMember) => {
    return !member.pending && member.roles.cache.size === 1
};

const authorize = async (members: Array<GuildMember>) => {
    if (members.length === 0) {
        return
    }
    await Promise.all(members.map((m) => m.roles.add(normalUserRoleId)));
    const channel = await members[0].guild.channels.fetch(joinLogChannelId)
    if (!(channel instanceof TextChannel)) {
        return
    }
    const embed = new MessageEmbed();
    const mentions = members
        .map((m) => `${memberNicknameMention(m.id)}さん`)
        .join('、');
    embed.setDescription(`${mentions}の認証が完了しました。`)
    embed.setColor('GREEN');
    await channel.send({embeds: [embed]})
};

client.on('guildMemberUpdate', async (before, after) => {
    const guild = after.guild;
    await lock.acquire(AUTHORIZE, async () => {
       if (!isAuthorizeable(after) || !before.pending) {
           return
       }
        if ((await guild.fetchOwner()).presence?.status === 'online') {
            await authorize([after]);
        }
        else {
            const channel = await guild.channels.fetch(joinLogChannelId)
            if (!(channel instanceof TextChannel)) {
                return
            }
            const embed = new MessageEmbed({
                description:
                    `${memberNicknameMention(after.id)}がルールを読みました。
                    ${memberNicknameMention(guild.ownerId)}がオンラインになると認証されます。
                    オンラインになるまでお待ちください。`
            });
            await channel.send({embeds: [embed]})
        }
    })
});

client.on('presenceUpdate', async (before, after)=>{
    if (
        !after.member
        // オーナー以外
        || after.member.guild.ownerId !== after.member.id
        // ステータスの変更以外
        || before?.status === after.status
        // オンラインでない
        || after.status !== 'online'
    ){
        return
    }
    const guild = after.member.guild;
    await lock.acquire(AUTHORIZE, async () =>{
        await authorize(Array.from(guild.members.cache.filter(isAuthorizeable).values()));
    })
})