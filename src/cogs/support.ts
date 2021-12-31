import {client} from '../index'
import {
    ButtonInteraction,
    Message,
    MessageActionRow,
    MessageButton,
    MessageComponentInteraction,
    MessageEmbedOptions,
    MessageSelectMenu,
    MessageSelectOptionData,
    TextChannel,
    ThreadChannel
} from 'discord.js';
import {supportChannelId, supportEnterChannelId} from '../constant';
import {userMention} from '@discordjs/builders';

const buttonName = 'supportStart'
const cancelSelect: MessageSelectOptionData = {
    label: 'キャンセル（スレッド削除）',
    value: 'cancel'
}

const backSelect: MessageSelectOptionData = {
    label: '戻る',
    value: 'back'
}

const QuestionType = {
    question: 'question',
    error: 'error',
    bug: 'bug',
    feature: 'feature',
    other: 'other'
} as const;

type QuestionTypeValue = typeof QuestionType[keyof typeof QuestionType]
type VersionType = 'v2' | 'v3'

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

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === buttonName) {
        await interaction.deferUpdate()
        await startSupport(interaction)
    }
})

client.on('ready', async () => {
    // await sendSupportButton()
    // await client.destroy()
})

function MessageInteractionListener(option: {
    thread: ThreadChannel,
    message: Message,
    ignore: (interaction: MessageComponentInteraction) => boolean
    back?: () => Promise<void>,
}){
    const {thread, message, ignore, back} = option
    const collector = thread.createMessageComponentCollector({
        filter: (args) => (args.message.id === message.id)
    });
    return new Promise<void | {newInteraction: MessageComponentInteraction, value: string}>((resolve, reject) => {
        const listener = async (newInteraction: MessageComponentInteraction) => {
            if(ignore(newInteraction)){
                await newInteraction.deferUpdate()
                return
            }
            const value = (() => {
                if(newInteraction.isSelectMenu()){
                    return newInteraction.values[0]
                } else if (newInteraction.isButton()){
                    return newInteraction.customId
                }
            })()
            if(!value){
                await newInteraction.deferUpdate()
                return
            }
            collector.off('collect', listener);
            if (value === 'cancel') {
                thread.delete().then(() => resolve())
            }
            else if (value === 'back') {
                back ? resolve(back()) : resolve()
                return
            }
            else{
                resolve({newInteraction, value})
            }
        }
        collector.on('collect', listener)
    })
}


async function sendSupportButton() {
    const channel = client.channels.cache.get(supportEnterChannelId)
    if (!channel?.isText()) {
        return
    }
    const row = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId(buttonName)
                .setLabel('サポートを開始する')
                .setStyle('PRIMARY')
        )
    await channel.send({
        content:
            'サポートご希望の方は以下のボタンを押してください。\n' +
            'あなた専用のスレッドが開きます。',
        components: [row]
    })
}

async function startSupport(interaction: ButtonInteraction) {
    const channel = client.channels.cache.get(supportChannelId)
    if (!(channel instanceof TextChannel)) {
        return
    }
    const thread = await channel.threads.create({
        name: '受付中',
        autoArchiveDuration: 60
    });
    await thread.send({
        content: userMention(interaction.user.id) + '\nスレッドを作成しました。'
    })
    try {
        await FirstAction({interaction: interaction, thread})
    } catch (e) {
        console.trace(e)
        await thread.delete()
    }
}

type FirstArgs = { interaction: MessageComponentInteraction, thread: ThreadChannel }


async function FirstAction(args: FirstArgs) {
    await _FirstAction({
        ...args
    })
}

// Todo: v3ロールアウト次第こっちに切り替える
async function _FirstAction(args: FirstArgs) {
    const {thread, interaction} = args
    const row = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('supportFirstAction')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions([
                    {
                        label: 'v2',
                        value: 'v2'
                    },
                    {
                        label: 'v3',
                        value: 'v3'
                    },
                    cancelSelect
                ])
        )

    const message = await thread.send({
        content: 'あなたが質問しようとしているのはv2, v3どちらについての質問ですか？',
        components: [row]
    })
    const ret = await MessageInteractionListener({
        thread, message,
        ignore:((i)=> i.user.id !== interaction.user.id || !interaction.isSelectMenu()),
        back: () => FirstAction(args),
    })
    if (ret){
        await SecondAction({
            ...args,
            interaction: ret.newInteraction,
            version: ret.value as VersionType,
            back: () => _FirstAction(args)
        })
    }
}

type SecondArgs = FirstArgs & { version: VersionType, back: () => Promise<void> }

async function SecondAction(args: SecondArgs) {
    const {interaction, thread, version, back} = args
    const options: MessageSelectOptionData[] = [
        {
            label: '使い方の質問',
            description: 'コマンドなどの使い方がわからない人はこちら',
            value: QuestionType.question
        }
    ]
    if (version === 'v3') {
        options.splice(
            options.length, 0,
            {
                label: '想定されていないエラー',
                description: '想定されていないエラーが出たらこちら',
                value: QuestionType.error
            },
            {
                label: 'バグ',
                description: '挙動がおかしいと思ったらこちらから',
                value: QuestionType.bug
            },
            {
                label: '機能追加',
                description: '役職パネルに新しい機能を実装して欲しいならこちら',
                value: QuestionType.feature
            },
        )
    }
    options.splice(
        options.length, 0,
        {
            label: 'その他',
            description: 'それ以外の項目',
            value: QuestionType.other
        },
        backSelect,
        cancelSelect
    )
    const row = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('supportSecondAction')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(options)
        )
    const message = await thread.send({
        content: 'あなたの質問はどの項目に該当しますか？',
        components: [row]
    })

    const ret = await MessageInteractionListener({
        thread, message, back,
        ignore: (i) => (i.user.id !== interaction.user.id || !i.isSelectMenu()),
    })
    if(ret){
        await ThirdAction({
            ...args,
            qType: ret.value as QuestionTypeValue,
            interaction: ret.newInteraction,
            back: () => SecondAction(args)
        })
    }
}

type ThirdArgs = SecondArgs & { qType: QuestionTypeValue }

async function ThirdAction(args: ThirdArgs) {
    // Todo: qTypeに応じた分岐
    const {qType} = args
    if((qType === 'question' || qType === 'other') && args.version === 'v2'){
        await QuestionAction1({
            ...args,
            back: () => ThirdAction(args)
        })
    }
    else{
        await ForthAction({
            ...args,
            back: () => ThirdAction(args)
        })
    }
}

async function QuestionAction1(args: ThirdArgs) {
    const {version, thread, interaction, back} = args
    const menu = new MessageSelectMenu()
        .setCustomId('supportQuestionAction1')
        .setMinValues(1)
        .setMaxValues(1)
    let questions: EmbedWithTitle[]
    if (version === 'v2') {
        questions = FrequentlyAskedQuestionsV2
    } else{
        return
    }
    menu.addOptions(questions.map((e, i) => {
        return {
            label: e.title,
            description: e.title,
            value: i.toString(),
        }
    }))
    menu.addOptions([
        {
            label: '該当しない',
            value: '-1'
        },
        backSelect,
        cancelSelect
    ])
    const row = new MessageActionRow()
        .addComponents(menu)
    const message = await thread.send({
        content: 'あなたの質問は以下に該当しませんか？',
        components: [row]
    })
    const collector = thread.createMessageComponentCollector({
        filter: (args) => (args.message.id === message.id)
    });
    const listener = async (interaction1: MessageComponentInteraction) => {
        if (interaction1.user.id !== interaction.user.id || !interaction1.isSelectMenu()) {
            await interaction1.deferUpdate()
            return
        }
        collector.off('collect', listener)
        const value = interaction1.values[0]
        if (value === 'cancel') {
            await thread.delete()
            return
        } else {
            await message.delete()
        }
        if (value === 'back') {
            await back()
        } else {
            const index = parseInt(value)
            if(index < 0){
                await ForthAction({
                    ...args,
                    interaction: interaction1,
                    back: () => QuestionAction1(args)
                })
                return
            }
            const embed = questions[index]
            await QuestionAction2({
                ...args,
                embed: embed,
                back: () => QuestionAction1(args)
            })
        }
    }
    collector.on('collect', listener)
}


async function QuestionAction2(args: ThirdArgs & {embed: MessageEmbedOptions}) {
    const {version, thread, interaction, embed, back} = args
    const row = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('OK')
                .setLabel('解決した')
                .setStyle('SUCCESS')
        )
        .addComponents(
            new MessageButton()
                .setCustomId('NG')
                .setLabel('解決しなかった')
                .setStyle('PRIMARY')
        )
        .addComponents(
            new MessageButton()
                .setCustomId('back')
                .setLabel('戻る')
                .setStyle('SECONDARY')
        )
        .addComponents(
            new MessageButton()
                .setCustomId('cancel')
                .setLabel('キャンセル(スレッド削除)')
                .setStyle('DANGER')
        )
    const message = await thread.send({
        content: '以下の内容で解決しましたか？',
        embeds: [embed],
        components: [row]
    })
    const collector = thread.createMessageComponentCollector({
        filter: (args) => (args.message.id === message.id)
    });
    const listener = async (interaction1: MessageComponentInteraction) => {
        if (interaction1.user.id !== interaction.user.id || !interaction1.isButton()) {
            await interaction1.deferUpdate()
            return
        }
        collector.off('collect', listener)
        const value = interaction1.customId
        if (value === 'cancel') {
            await thread.delete()
            return
        }
        if (value === 'back') {
            await message.delete()
            await back()
            return
        }
        else if(value === 'NG'){
            await message.delete()
            await ForthAction({
                ...args,
                interaction: interaction1,
                back: () => QuestionAction2(args)
            })
        }
        else{
            await interaction1.deferUpdate()
            await thread.edit({
                locked: true,
                archived: true,
                name: 'よくある質問で解決'
            })
        }
    }
    collector.on('collect', listener)
}


type ForthArgs = ThirdArgs & { traceback?: string }

async function ForthAction(args: ForthArgs) {
    const {thread, interaction} = args
    const message = await thread.send({
        content: '質問の概要を書いたメッセージをこのスレッドに投稿してください(50字以内)\n' +
            '※スレッドのタイトルになります'
    })
    const collector = thread.createMessageCollector({
        filter: (m) => (
            interaction.user.id === m.author.id
            && m.channel.id === thread.id
        )
    })
    const handler = async (response: Message) => {
        if (response.content.length > 50) {
            await thread.send('50文字以内で入力してください')
            return
        }
        collector.off('collect', handler)
        await message.delete()
        await FifthAction(
            {
                ...args,
                title: response.content,
            }
        )
    }
    collector.on('collect', handler)
}

type FifthArgs = ForthArgs & { title: string }

async function FifthAction(args: FifthArgs) {
    const {thread, interaction, back} = args
    const row = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('OK')
                .setLabel('OK')
                .setStyle('PRIMARY')
        )
        .addComponents(
            new MessageButton()
                .setCustomId('back')
                .setLabel('戻る')
                .setStyle('SECONDARY')
        )
        .addComponents(
            new MessageButton()
                .setCustomId('cancel')
                .setLabel('キャンセル(スレッド削除)')
                .setStyle('DANGER')
        )
    const message = await thread.send({
        content: 'この内容でよろしいですか？',
        components: [row]
    })
    const collector = thread.createMessageComponentCollector({
        filter: (args) => (args.message.id === message.id)
    });
    const listener = async (interaction1: MessageComponentInteraction) => {
        if (interaction1.user.id !== interaction.user.id || !interaction1.isButton()) {
            await interaction1.deferUpdate()
            return
        }
        collector.off('collect', listener)
        const value = interaction1.customId
        if (value === 'cancel') {
            await thread.delete()
        } else {
            await message.delete()
        }
        if (value === 'back') {
            await back()
        } else if (value === 'OK') {
            await SettingThread(args)
        }

    }
    collector.on('collect', listener)

}

type SettingThreadArgs = Readonly<FifthArgs>


function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function SettingThread(args: SettingThreadArgs) {
    const title = `[${args.version}-${capitalize(args.qType)}]${args.title}`
    await args.thread.edit({
        name: title,
        autoArchiveDuration: 1440
    })
    await args.thread.send('スレッドの準備が整いました。\n質問の内容を入力してください。')
}