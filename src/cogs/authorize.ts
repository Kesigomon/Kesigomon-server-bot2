import AsyncLock from 'async-lock';
import {
    ButtonInteraction,
    GuildMember, Interaction,
    InteractionResponseFields, MessageActionRow,
    MessageButton,
    MessageEmbed, MessageMentionOptions, TextChannel
} from 'discord.js';
import {client} from '../index';
import {joinLogChannelId, messageLinkToStopRolepanel, newsChannelId, normalUserRoleId, preAuthorizeRoleId, ruleChannelId} from '../constant';
import {channelMention, userMention} from '@discordjs/builders';
import {shuffle, sleep} from '../lib';
import {MessageButtonStyles} from 'discord.js/typings/enums';

const InteractionIdPrefix = 'AuthorizeQuestion'
const InteractionIdPrefixCorrect = InteractionIdPrefix + 'Correct'
const InteractionIdPrefixWrong = InteractionIdPrefix + 'Wrong'

const lock = new AsyncLock();
const AUTHORIZE = 'authorize';

const isAuthorizeable = (member: GuildMember) => {
    return member.roles.cache.has(preAuthorizeRoleId)
};

const checked_authorize = async (member: GuildMember) => {
    const guild = member.guild;
    await lock.acquire(AUTHORIZE, async () => {
        member = await member.fetch(true);
        if ((await guild.fetchOwner()).presence?.status === 'online') {
            await authorize([member], true);
        } else {
            await member.roles.add(preAuthorizeRoleId)
            const channel = await guild.channels.fetch(joinLogChannelId)
            if (!(channel instanceof TextChannel)) {
                return
            }
            await channel.send({
                content: `${userMention(member.id)}さんの仮認証が完了しました。\n`
                    + 'オーナーがオンラインになると自動で認証されます。認証までしばらくお待ちください。',
            })
        }
    })
}

const authorize = async (members: Array<GuildMember>, notify = false) => {
    if (members.length === 0) {
        return
    }
    await Promise.all(members.map(async (m) => {
        await m.roles.remove(preAuthorizeRoleId).catch(() => {
        })
        await m.roles.add(normalUserRoleId)
    }));
    const channel = await members[0].guild.channels.fetch(joinLogChannelId)
    if (!(channel instanceof TextChannel)) {
        return
    }
    const mentions = members
        .map((m) => `${userMention(m.id)}さん`)
        .join('、');
    const allowedMentions: MessageMentionOptions = notify ? {} : {
        roles: [],
        parse: [],
        users: [],
        repliedUser: false
    };
    await channel.send({
        content: `${mentions}の認証が完了しました。`,
        allowedMentions: allowedMentions
    })
};

client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) {
        return;
    }
    await sleep(3000);
    member = await member.fetch(true);
    if (member.roles.cache.size >= 2) {
        return
    }
    const channel = client.channels.resolve(joinLogChannelId)
    if (channel instanceof TextChannel) {
        await channel.send(
            `${userMention(member.id)}さん、ケシゴモンのサーバーへようこそ。\n`
            + `まずは${channelMention(ruleChannelId)}を確認してください！\n\n`
            + `役職パネルの停止につきましては、${messageLinkToStopRolepanel}をご確認ください。`
        )
    }
})

client.on('presenceUpdate', async (before, after) => {
    if (
        !after.member
        // オーナー以外
        || after.member.guild.ownerId !== after.member.id
        // ステータスの変更以外
        || before?.status === after.status
        // オンラインでない
        || after.status !== 'online'
    ) {
        return
    }
    const guild = after.member.guild;
    await lock.acquire(AUTHORIZE, async () => {
        await authorize(Array.from(guild.members.cache.filter(isAuthorizeable).values()));
    })
})

/*
client.on('ready', async () => {
    const channel = client.channels.resolve(ruleChannelId)
    if (!(channel instanceof TextChannel)) {
        return
    }
    const row = new MessageActionRow();
    const button = new MessageButton()
        .setLabel('このボタンを押すと認証できます。')
        .setStyle(MessageButtonStyles.PRIMARY)
        .setCustomId('AuthorizeQuestionStart')
    row.addComponents(button)
    await channel.send({
        content: "認証の前にルールについてのクイズに答える必要があります。\nクイズに答えることで認証・仮認証されます。",
        components: [row]
    })
})
*/

client.on('interactionCreate', async (interaction) => {
    if (
        !interaction.inCachedGuild()
        || !interaction.isButton()
        || interaction.customId !== 'AuthorizeQuestionStart'
        || !interaction.member
    ) {
        return
    }
    if (
        interaction.member.roles.cache.size > 1
    ) {
        await interaction.reply({
            content: 'あなたはすでに認証、または仮認証されています。',
            ephemeral: true,
        })
        return
    }
    await interaction.deferUpdate();
    let replyTo: InteractionResponseFields<'cached'> = interaction;
    let delay = 5;
    for (const [index, question] of questions.entries()) {
        const embed1 = new MessageEmbed({
            title: `第${index + 1}問`,
            description: question.question
        })
        const message = await appearQuiz(replyTo, embed1, question.selects)
        const newInteraction = await new Promise<ButtonInteraction<'cached'>>((resolve) => {
            const handler = async (newInteraction: Interaction) => {
                if (
                    !newInteraction.inCachedGuild()
                    || !newInteraction.isButton()
                    || newInteraction.channelId !== message.channelId
                    || newInteraction.message.id !== message.id
                ) {
                    return
                }
                client.off('interactionCreate', handler)
                resolve(newInteraction)
            }
            client.on('interactionCreate', handler)
        })
        const isCorrect = newInteraction.customId.startsWith(InteractionIdPrefixCorrect)
        const embed2 = new MessageEmbed()
        if (isCorrect) {
            embed2.setTitle('正解です！')
            embed2.setColor('GREEN')
        } else {
            embed2.setTitle('不正解です・・・')
            embed2.setColor('RED')
            delay *= 2
        }
        const answerIs = question.selects.filter(
            (_, index) => question.answer?.at(index) ?? index === 0
        ).map((value) => `「${value}」`).join('または')
        embed2.setDescription(
            `正解は${answerIs}です。
            \n\n${question.description}`
        )
        if (index < questions.length - 1) {
            embed2.setFooter({text: `${delay}秒後に次の問題が出ます。`})
        } else {
            embed2.setFooter({text: `${delay}秒後に認証・仮認証されます。`})
        }
        await newInteraction.reply({
            embeds: [embed2],
            ephemeral: true,
            fetchReply: true
        })
        replyTo = newInteraction;
        await sleep(delay * 1000);
    }
    await checked_authorize(interaction.member)
})

type questionsType = {
    question: string,
    selects: string[],
    description: string
    answer?: boolean[]
}

// Todo: 説明を追記する
const questions: questionsType[] = [
    {
        question: 'あなたは役職パネルの質問があります。\nさて、まず何をするべきですか？',
        selects: [
            '役職パネルはサービスを終了しているため、質問できない。',
            'ローカルルームに質問を書く',
            'サーバーオーナーにDMを送る',
            
        ],
        description: '役職パネルは3/22をもって、サービスを終了いたしました。' +
            '長らくのご利用ありがとうございました。'
    },
    {
        question: 'このサーバーでは、他のサーバーの宣伝をすることができますか？',
        selects: [
            'アクティブユーザーになればできる。',
            'できない。',
            '認証されればできる。',
        ],
        description: 'アクティブユーザーは、このサーバーでたくさん発言されているとサーバーオーナーが判断すると付与されます。\n' +
            'なのでいっぱい話してくれると嬉しいです。'
    }
]


const appearQuiz = (
    interaction: InteractionResponseFields<'cached'>,
    embed: MessageEmbed,
    _selects: string[],
    answer?: boolean[],
) => {
    if (!answer) {
        answer = new Array(_selects.length)
            .fill(true, 0, 1)
            .fill(false, 1);
    }
    const rows: MessageActionRow[] = []
    const selects = [..._selects.entries()]
    shuffle(selects)
    for (const [i, s] of selects) {
        let row;
        if (rows.length === 0 || rows[rows.length - 1].components.length >= 5) {
            row = new MessageActionRow()
            rows.push(row)
        } else {
            row = rows[rows.length - 1]
        }
        const button = new MessageButton()
        button.setStyle(MessageButtonStyles.PRIMARY)
        button.setLabel(s)
        button.setCustomId((answer.at(i) ?? false ? InteractionIdPrefixCorrect : InteractionIdPrefixWrong) + `${i}`)
        row.addComponents(button)
    }
    return interaction.followUp({
        components: rows,
        embeds: [embed],
        ephemeral: true,
        fetchReply: true
    })
}
