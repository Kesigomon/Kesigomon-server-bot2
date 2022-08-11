import AsyncLock from 'async-lock';
import {
    GuildMember,
    InteractionResponseFields,
    MessageActionRow,
    MessageButton,
    MessageEmbed, MessageEmbedOptions,
    TextChannel
} from 'discord.js';
import {client} from '../index';
import {joinLogChannelId, normalUserRoleId} from '../constant';
import {memberNicknameMention} from '@discordjs/builders';
import {shuffle} from "../lib";
import {MessageButtonStyles} from "discord.js/typings/enums";

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

type qustionsType = {
    question: string,
    selects: string[],
    description: string
}

// Todo: 説明を追記する
const questions: qustionsType[] = [
    {
        question: "あなたは役職パネルの質問があります。\nさて、まず何をするべきですか？",
        selects: [
            "新役職パネル質問室入口を見る",
            "ローカルルームに質問を書く",
            "サーバーオーナーにDMを送る",
        ],
        description: "実は、よくある質問への回答は認証前でも確認することができます。\n" +
            "もちろん、このクイズを解いているときでも。\n" +
            "「解決できませんでした」の選択肢のみ認証後にしか使えません。"
    },
    {
        question: "このサーバーでは、他のサーバーの宣伝をすることができますか？",
        selects: [
            "アクティブユーザーになればできる。",
            "できない。",
            "認証されればできる。",
        ],
        description: ""
    }
]
const appearQuiz = (
    interaction: InteractionResponseFields<'cached'>,
    embed: MessageEmbed,
    selects: string[],
    answer?: boolean[],
) => {
    if (!answer){
        answer = new Array(selects.length)
            .fill(true, 0, 1)
            .fill(false, 1);
    }
    const rows: MessageActionRow[] = [];
    shuffle(selects);
    for (const [i, s] of selects.entries()) {
        let row;
        if(rows.length === 0 || rows[rows.length - 1].components.length >= 5){
            row = new MessageActionRow()
            rows.push(row)
        }
        else{
            row = rows[rows.length - 1]
        }
        const button = new MessageButton()
        button.setStyle(MessageButtonStyles.PRIMARY)
        button.setLabel(s)
        button.setCustomId("AuthorizeQuestion" + (answer.at(i) ?? false ? "Correct" : "Wrong"))
        row.addComponents(button)
    }
    return interaction.reply({
        components: rows,
        embeds: [embed],
        ephemeral: true,
        fetchReply: true
    })
}