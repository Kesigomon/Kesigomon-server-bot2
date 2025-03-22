import { client } from '../index'
import * as constant from '../constant';
import { Message, TextChannel } from 'discord.js';

const pattern = /[\w\-]{22,28}\.[\w\-]{4,8}\.[\w\-]{26,30}/;
const pattern1 = /(@everyone|@here)/;
const pattern2 = /<@.?(\d+?)>/;
const pattern3 = /discord(?:\.gg|(app)?\.com\/invite)\/([a-zA-Z0-9]+)/;

client.on("messageCreate", async (message) => {
    if (pattern.test(message.content)) {
        await message.delete()
        await message.member?.ban({
            reason: "トークンと思わしきメッセージ送信のため"
        })
    }
    // メンションの処理
    await handleMention(message);
    
    // 招待リンクの処理
    await handleInviteLink(message);
})

const handleMention = async (message: Message) => {
    const member = message.member;
    const matches = [...message.content.matchAll(pattern2)];
    // everyone/here または メンションが5つ以上
    if(
        !pattern1.test(message.content) && matches.length < 5
    ){
        return;
    }
    // メンション権限があるなら無視
    if(member && message.channel.type !== 'DM' && message.channel.permissionsFor(member).has('MENTION_EVERYONE')){
        return;
    }
    // メンションを含むメッセージを削除
    await message.delete();
    // Memberでないなら終了
    // Todo: ホントは外部アプリ使ってきたやつをLimitしたいところ
    if(!member){
        return;
    }
    // limitRoleを付与
    await member.roles.set([constant.limitRoleId]);
}


const handleInviteLink = async (message: Message) => {
    const member = message.member;
    // BOTまたはnormalUserより強い権限を持つユーザーは無視
    if(member && (message.author.bot || member.roles.highest.comparePositionTo(constant.normalUserRoleId) > 0)){
        return;
    }
    // 招待リンクがなければ無視
    if (!pattern3.test(message.content)) {
        return;
    }
    // 招待リンクを含むメッセージを削除
    await message.delete();
    // Memberでないなら終了
    // Todo: ホントは外部アプリ使ってきたやつをLimitしたいところ
    if(!member){
        return;
    }
    await member.roles.set([constant.limitRoleId]);
    const channel = (await client.channels.fetch(constant.limitChannelId)) as TextChannel;
    await channel.send(
        `${message.author}\n考えてください\n宣伝ってこっちに何もメリットないじゃないですか\nこれで宣伝できたらあまりにも虫が良すぎませんか？\nそちらのメリットは別に聞いてないので、反論があるのならばそれ以外の方向からお願いします。`
    );
}