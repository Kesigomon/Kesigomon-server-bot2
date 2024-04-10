import {
    Client,
    MessageActionRow,
    MessageActionRowComponent,
    MessageButton,
    MessageEmbed,
    MessageEmbedOptions, ModalActionRowComponent,
    TextChannel
} from 'discord.js';
import {client} from '../index';
import {supportLogChannelId} from '../constant';
import {userMention} from '@discordjs/builders';
import * as wasi from 'wasi';

type EmbedWithTitle = (MessageEmbedOptions & { [P in 'title']: NonNullable<MessageEmbedOptions[P]> })

const FrequentlyAskedQuestionsV2: EmbedWithTitle[] = [
    {
        'fields': [
            {
                'inline': true,
                'name': '対処法',
                'value': '役職の順序を入れ替えてください。' +
                    '\nサーバー設定の役職タブで役職をドラッグアンドドロップで移動出来ます。' +
                    '\niOSの場合は右上のボタンから編集ボタンをタップすると可能です。'
            }
        ],
        'description': '理由:「役職パネルv2」という役職が 付与・解除 をしたい役職より上になっていない',
        'title': '「役職の付与に失敗しました。BOTの一番上よりも高い役職をつけようとしてるかも？」と表示されたのですが……'
    },
    {
        'fields': [
            {
                'inline': true,
                'name': '対処法',
                'value': 'サーバーの所有者 or 追加/削除しようとしている役職よりも上の役職を持つメンバーにコマンドを頼む'
            }
        ],
        'description': '理由:あなたの一番上の役職以上の役職を追加/削除しようとしている。',
        'title': 'XXXは、あなたの一番上の役職以上の役職でないので、追加/削除できません'
    },
    {
        'fields': [
            {
                'inline': true,
                'name': 'コマンド',
                'value': '```!rp2 add role -t tag```\n' +
                    'のように、-tオプションでタグを指定できる。\n' +
                    '```!rp2 add 役職 -t タグ```\n' +
                    '既存のパネルとは違うタグを指定した場合、新しくパネルが作られます。'
            }
        ],
        'description': '対処法:タグを別なものとすれば、新しいパネルが作成される',
        'title': 'パネルを分けたい　複数作りたい'
    },
    {
        'description': '理由:Discord側のバグ。' +
            '\nもし正常に役職を付けられているのであれば役職パネル側の問題ではありません。',
        'title': 'なぜかパネルの役職がdeleted-roleになるんだけど！'
    },
    {
        'title': 'コマンドが反応しない',
        'description': '理由:Discordの仕様変更によるもの。\n' +
            '9/1からBOTがメッセージの内容を取得することができなくなったため、コマンドに反応しなくなりました。\n' +
            '以降もパネルの追加・変更を行いたい場合は、役職パネルv3をお使いください。\n\n' +
            'リアクションを押して役職を付与・解除する機能は、今後もお使い頂けます。'
    },
    {
        'fields': [
            {
                'inline': true,
                'name': '役職パネルv2ドキュメント',
                'value': 'https://kesigomon.hatenablog.jp/entry/2020/05/19/203644'
            },
            {
                'inline': true,
                'name': '役職パネル よくある質問',
                'value': 'https://kesigomon.hatenablog.jp/entry/2020/04/25/005421'
            }
        ],
        'title': 'ドキュメントを読みたい'
    }
]

const FrequentlyAskedQuestionsV3: EmbedWithTitle[] = [
    {
        'title': '基本的なコマンドの使い方を教えてほしい',
        'description': 'こちらをお読みください。\n'
            + 'https://w.atwiki.jp/discord_rolepanel/pages/23.html'
    },
    {
        'title': 'BOTの導入をしたい',
        'description': 'こちらからどうぞ。\n' +
            'https://discord.com/api/oauth2/authorize?client_id=971523089550671953&permissions=268790848&scope=bot%20applications.commands',
    },
    {
        'title': '違うパネルが変更されてしまう・パネルが選択されていません。と表示された',
        'description': 'パネルの選択ができていない\n' +
            'コマンドの前にパネルを選択しましょう\n' +
            'https://w.atwiki.jp/discord_rolepanel/pages/12.html'
    },
    {
        'fields': [
            {
                'inline': true,
                'name': '対処法',
                'value': '役職の順序を入れ替えてください。' +
                    '\nサーバー設定の役職タブで役職をドラッグアンドドロップで移動出来ます。' +
                    '\niOSの場合は右上のボタンから編集ボタンをタップすると可能です。'
            }
        ],
        'description': '理由:「役職パネルv3」という役職が 付与・解除 をしたい役職より上になっていない',
        'title': '「役職の付与に失敗しました。BOTの一番上よりも高い役職をつけようとしてるかも？」と表示されたのですが……'
    },
    {
        'fields': [
            {
                'inline': true,
                'name': '対処法',
                'value': 'サーバーの所有者 or 追加/削除しようとしている役職よりも上の役職を持つメンバーにコマンドを頼む'
            }
        ],
        'description': '理由:あなたの一番上の役職以上の役職を追加/削除しようとしている。',
        'title': 'XXXは、あなたの一番上の役職以上の役職でないので、追加/削除できません'
    },
    {
        'title': '権限不足です。以下の権限があるかもう一度確認してください。と表示された',
        'description': 'サーバー設定から行えるロールの権限設定では必要な権限を付与できているように見えても、' +
            'カテゴリやチャンネルの設定では許可されておらず権限不足になるというケースが良くあります。\n' +
            'カテゴリやチャンネルの権限設定を確認してください。\n' +
            '`/rp debug` コマンドもパネルのあるチャンネルで試してみてみるのも良いでしょう。\n' +
            'チャンネル権限情報のどれかが:x:であった場合、その権限が不足していることを表します。'
    },
    {
        'description': '理由:Discord側のバグ。' +
            '\nもし正常に役職を付けられているのであれば役職パネル側の問題ではありません。',
        'title': 'なぜかパネルの役職がdeleted-roleになるんだけど！'
    },
    {
        title: '(スラッシュコマンドの時)役職を作成したのに選択できない・「無効なロールです」と出た',
        description: '理由: 役職がない or Discordのバグ\n' +
            '1. Discordを再起動してみてください。\n' +
            '2. 役職が本当に作成されているか、サーバー設定の役職から確認してください。\n' +
            '3. もしPCをお持ちであれば、PC版で試してみてください。',
    },
    {
        title: '/を押してもコマンド一覧が出ない',
        description: '1. Discordは最新のバージョンですか？もし最新でなければ、最新バージョンにアップデートしてください。\n' +
            '2. __**あなた**__に「アプリコマンドを使う」の権限がありますか？' +
            'もしなければ、サーバー管理者に連絡して、その権限を貰うようにして下さい。\n' +
            'サーバー設定から行えるロールの権限設定では必要な権限を付与できているように見えても、' +
            'カテゴリやチャンネルの設定では許可されておらず権限不足になるというケースが良くあります。\n' +
            'カテゴリやチャンネルの権限設定の確認も忘れずに行ってもらってください。\n' +
            '3. 「ユーザー設定」→「テキスト・画像」→「スラッシュコマンドを使い、絵文字、メンション、マークダウン構文を入力時にプレビューする」' +
            'がオフになっていませんか？オンにしないとスラッシュコマンドが使えないので、オンにしてください。'
    },
    {
        'fields': [
            {
                'inline': true,
                'name': '役職パネルv3ドキュメント',
                'value': 'https://w.atwiki.jp/discord_rolepanel'
            }
        ],
        'title': 'ドキュメントを読みたい'
    },
    {
        'title': 'BOTがリアクションに反応しない',
        'description': '理由:現在調査中のバグ。\n' +
            '暫定的ですが、以下の手順で該当のパネルに再度反応するようになります。\n' +
            'https://w.atwiki.jp/discord_rolepanel/pages/12.html'
    }
]

const getQuestions = (version: string) => {
    if (version === 'v2') {
        return FrequentlyAskedQuestionsV2;
    } else {
        return FrequentlyAskedQuestionsV3;
    }
}



const addComponentToRows = <T extends MessageActionRowComponent | ModalActionRowComponent, U>
(rows: MessageActionRow<T, U>[], components: U) => {
    if (rows.length === 0 || rows[rows.length - 1].components.length >= 5) {
        rows.push(new MessageActionRow<T, U>().addComponents(components));
    } else {
        rows[rows.length - 1].addComponents(components);
    }
}


export const regenEnterMessage = async (client: Client) => {
    // const channelId = '704243445778087978'
    const channelId = '893822808113709107'
    const channel = await client.channels.fetch(channelId, {allowUnknownGuild: true});
    if (!(channel instanceof TextChannel)) {
        return;
    }
    for (const version of ['v2', 'v3']) {
        const embed = new MessageEmbed();
        embed.setTitle(`${version}よくある質問集`);
        const rows: MessageActionRow[] = [];
        const descriptions: string[] = [];
        getQuestions(version).forEach((e, i) => {
            const emoji = String.fromCodePoint(0x1f1e6 + i);
            descriptions.push(`${emoji}: ${e.title}`);
            const button = new MessageButton()
                .setCustomId(`FAQ-${version}-${i}`)
                .setLabel(emoji)
                .setStyle('PRIMARY');
            addComponentToRows(rows, button);
        });
        embed.setDescription(descriptions.join('\n\n'));
        if (version !== 'v2') {
            embed.setFooter({text: 'v2のよくある質問は上にあります'});
            const button = new MessageButton()
                .setCustomId('supportStart') // Todo: サポート定数に変える
                .setLabel('解決しなかった')
                .setStyle('SECONDARY');
            addComponentToRows(rows, button);
        }
        await channel.send({
            embeds: [embed],
            components: rows
        });
    }
    await channel.send(
        '上にv2, v3のよくある質問が書かれています。\n' +
        'リアクションを押すと、質問に対する回答が表示されます'
    )
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        const match = /FAQ-(v2|v3)-(\d+)/.exec(interaction.customId);
        if(!match){
            return
        }
        const embed = getQuestions(match[1]).at(Number(match[2]));
        if(!embed){
            await interaction.reply({
                content: "回答が見つかりませんでした。これが表示されているのは多分バグです。多分。"
            })
            return;
        }
        await interaction.reply({
            embeds: [embed],
            ephemeral: true,
        })
        const channel = client.channels.resolve(supportLogChannelId);
        if (channel instanceof TextChannel){
            const content = `${userMention(interaction.user.id)}が${match[1]}の\`${embed.title}\`を見ました`
            await channel.send({
                content: content,
                allowedMentions: {
                    roles: [],
                    parse: [],
                    users: [],
                    repliedUser: false
                }
            })
        }
    }
})
