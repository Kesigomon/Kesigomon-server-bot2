import { Client, ClientEvents, DiscordAPIError, Message, MessageEmbed } from 'discord.js'
import { roleMention, userMention } from '@discordjs/builders'
import { sleep } from '../lib'
import { rolepanelLogChannelId, rolepanelUserId } from '../constant'

const panelFotterName = '役職パネル'

const isPanel = (message: Message) => {
    return (
        message.author.id === rolepanelUserId &&
        message.embeds.at(0)?.footer?.text === panelFotterName
    )
}

const is403Error = (e: unknown): e is DiscordAPIError => {
    return e instanceof DiscordAPIError && e.httpStatus === 403
}

export async function onReactionAdd(
    client: Client,
    [reaction, user]: ClientEvents['messageReactionAdd']
) {
    // Ready前 or 自分自身のリアクションの場合は無視
    if (!client.user || user.id === client.user.id) {
        return
    }
    let message = reaction.message
    const guild = message.guild
    const me = guild?.members.me
    const channel = message.channel
    // ギルドのメッセージ以外のリアクションは無視
    if (!guild || !me || channel.type === 'DM') {
        return
    }
    const permission = channel.permissionsFor(me)
    // メッセージの履歴を読む権限が無い場合は無視
    if (
        !permission.has('READ_MESSAGE_HISTORY') ||
        !permission.has('VIEW_CHANNEL')
    ) {
        return
    }
    try {
        message = await reaction.message.fetch(false)
    } catch (e) {
        // Missing Access
        if (e instanceof DiscordAPIError && e.code === 50001) {
            return
        }
        throw e
    }
    const member = guild.members.resolve(user.id)!
    if (isPanel(message)) {
        try {
            await reaction.users.remove(user.id)
        } catch (e) {
            // Ignore Forbidden Error
            if (!is403Error(e)) {
                throw e
            }
        }
        const panelDescription = message.embeds[0].description
        if (!panelDescription) {
            return
        }
        const pattern = RegExp(reaction.emoji.toString() + ':<@&(\\d*)>')
        const match = pattern.exec(panelDescription)
        if (!match) {
            return
        }
        const role = await guild.roles.fetch(match[1], { force: false })
        let description,
            actionName,
            logContent = '',
            reason: string | null = null
        if (!role) {
            actionName = 'NOTFOUND'
            description = '役職が存在しないか、見つかりませんでした。'
        } else {
            const mention = roleMention(role.id)
            let action
            if (!member.roles.cache.has(role.id)) {
                action = () => member.roles.add(role)
                actionName = 'ADD'
                description = `${mention}の役職を付与しました。`
            } else {
                action = () => member.roles.remove(role)
                actionName = 'REMOVE'
                description = `${mention}の役職を解除しました。`
            }
            try {
                await action()
                actionName += ':SUCCESS'
            } catch (e) {
                if (!is403Error(e)) {
                    throw e
                }
                actionName += ':FAILED'
                description = '役職の設定に失敗しました。\n'
                const me = guild.me!
                if (!me.permissions.has('MANAGE_ROLES')) {
                    description += 'BOTに「役職の管理」の権限が無いかも？'
                    reason = 'MISSING_PERMISSION'
                } else if (me.roles.highest.position <= role.position) {
                    description +=
                        'BOTの一番上の役職よりも高い役職をつけようとしてるかも？'
                    reason = 'ROLE_POSITION'
                } else if (!!role.tags?.botId) {
                    description += '特定のBOTにしか付与できない役職であるからかも？'
                    reason = 'BOT_ROLE'
                } else if (!!role.tags?.premiumSubscriberRole) {
                    description += 'サーバーブースター用の役職であるからかも？'
                    reason = 'SUBSCRIBER_ROLE'
                } else if (role.id === role.guild.id) {
                    description += 'everyone役職であるからかも？'
                    reason = 'EVERYONE_ROLE'
                } else {
                    description += 'エラーの原因がぜんぜんわからん！'
                    reason = 'UNKNOWN'
                }
            }
        }
        logContent +=
            `[ROLE-${actionName}]` +
            ` guild:\`${guild.name} (ID:${guild.id})\`` +
            ` ch:\`${channel.name} (ID:${channel.id})\`` +
            ` user:\`${user.username} (ID:${user.id})\``
        if (role) {
            logContent += ` role:\`${role.name} (ID:${role.id})\``
        } else {
            logContent += ` role:\`(ID:${match[1]})\``
        }
        if (reason) {
            logContent += ` reason:\`${reason}\``
        }
        try{
            const logChannel = await guild.channels.fetch(rolepanelLogChannelId)
            if(logChannel?.type === "GUILD_TEXT"){
                await logChannel.send({
                    content: logContent,
                })
            }
        }
        catch(e){
            console.log(e)
        }
        if (!channel.permissionsFor(client.user.id)?.has('SEND_MESSAGES')) {
            return
        }
        try {
            const newMessage = await channel.send({
                content: userMention(user.id),
                embeds: [
                    new MessageEmbed({
                        description: description,
                    }),
                ],
            })
            await sleep(10 * 1000)
            await newMessage.delete()
        } catch { }
    }
}