import {client} from '../index'
import {
    BaseCommandInteraction,
    ButtonInteraction, Interaction,
    Message,
    MessageActionRow,
    MessageButton,
    MessageComponentInteraction,
    MessageEmbedOptions,
    MessageSelectMenu,
    MessageSelectOptionData, Modal, ModalActionRowComponent,
    TextChannel, TextInputComponent,
    ThreadChannel
} from 'discord.js';
import {supportChannelId, supportEnterChannelId} from '../constant';
import {channelMention} from '@discordjs/builders';

const buttonName = 'supportStart'
const cancelSelect: MessageSelectOptionData = {
    label: '解決した（スレッド削除）',
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

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === buttonName) {
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
}) {
    const {thread, message, ignore, back} = option
    const collector = thread.createMessageComponentCollector({
        filter: (args) => (args.message.id === message.id)
    });
    return new Promise<void | { newInteraction: MessageComponentInteraction, value: string }>((resolve, reject) => {
        const listener = async (newInteraction: MessageComponentInteraction) => {
            if (ignore(newInteraction)) {
                await newInteraction.deferUpdate()
                return
            }
            const value = (() => {
                if (newInteraction.isSelectMenu()) {
                    return newInteraction.values[0]
                } else if (newInteraction.isButton()) {
                    return newInteraction.customId
                }
            })()
            if (!value) {
                await newInteraction.deferUpdate()
                return
            }
            collector.off('collect', listener);
            if (value === 'cancel') {
                thread.delete().then(() => resolve())
                return
            }
            await newInteraction.deferUpdate();
            if (value === 'back') {
                back ? resolve(back()) : resolve()
                return
            } else {
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
    await interaction.reply({
        content: channelMention(thread.id) + '\nスレッドを作成しました。クリックして確認してください。',
        ephemeral: true,
    });
    try {
        await FirstAction({interaction: interaction, thread})
    } catch (e) {
        console.trace(e)
        await thread.delete()
    }
}

type FirstArgs = { interaction: MessageComponentInteraction, thread: ThreadChannel }


async function FirstAction(args: FirstArgs) {
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
        ignore: ((i) => i.user.id !== interaction.user.id || !i.isSelectMenu()),
        back: () => FirstAction(args),
    })
    if (ret) {
        await SecondAction({
            ...args,
            interaction: ret.newInteraction,
            version: ret.value as VersionType,
            back: () => FirstAction(args)
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
    if (ret) {
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
    await ForthAction({
        ...args,
        back: () => ThirdAction(args)
    })
}


type ForthArgs = ThirdArgs & { traceback?: string }

async function ForthAction(args: ForthArgs) {
    // Todo: input モーダルを使う
    // Todo: モーダル再表示ボタンを作る
    const {thread, interaction} = args
    const showModal = async (interaction: BaseCommandInteraction | MessageComponentInteraction) => {
        const modal = new Modal()
            .setCustomId(thread.id)
            .setTitle('質問入力フォーム');
        const components = [
            new TextInputComponent()
                .setRequired(true)
                .setCustomId('title')
                .setStyle('SHORT')
                .setMinLength(1)
                .setMaxLength(50)
                .setLabel('質問の概要を書いてください'),
            new TextInputComponent()
                .setRequired(false)
                .setCustomId('description')
                .setStyle('PARAGRAPH')
                .setLabel('質問の詳細を書いてください'),
        ]
        const rows = components.map((component) =>
            new MessageActionRow<ModalActionRowComponent>()
                .addComponents(component)
        );
        modal.addComponents(...rows);
        await interaction.showModal(modal)
    };
    await showModal(interaction);
    const row = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('reshow')
                .setLabel('再表示')
                .setStyle('PRIMARY')
        )
    const reshowMessage = await thread.send({
        content: 'もし入力ボックスを閉じてしまったのなら、以下のボタンから再表示できます。',
        components: [row]
    });
    const handler = async (newInteraction: Interaction) => {
        if (newInteraction.isButton()) {
            if (
                newInteraction.customId === 'reshow'
                && newInteraction.message.id === reshowMessage.id
                && newInteraction.channelId === thread.id
            ) {
                if (interaction.user.id === newInteraction.user.id) {
                    await showModal(newInteraction);
                } else {
                    await newInteraction.reply({
                        content: `あなたには使えません。新しくスレッドを作成して下さい。
                        \n${channelMention(supportEnterChannelId)}`,
                        ephemeral: true
                    })
                }
            }
            return;
        } else if (
            !newInteraction.isModalSubmit() || newInteraction.customId !== interaction.channelId
        ) {
            return
        }
        client.off('interactionCreate', handler);
        try{
            await reshowMessage.delete();
        }
        catch {

        }
        await newInteraction.deferUpdate();
        const title = newInteraction.fields.getTextInputValue("title");
        const description = newInteraction.fields.getTextInputValue("description");
        await SettingThread({
            ...args,
            title, description
        })
    }
    client.on('interactionCreate', handler);
}

type FifthArgs = ForthArgs & { title: string, description: string }


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
    await args.thread.send(
        '質問の詳細\n```\n' + args.description + '\n```'
    )
    await args.thread.send('' +
        'スレッドの準備が整いました。\n' +
        '他に質問に関して書きたいことや、エラーなどのスクリーンショットがあれば、このスレッドに投稿してください。\n' +
        'もし質問が解決したなら、解決した旨を書いてください。何も書かずにサーバーを退出するのはやめてください。\n' +
        '/rp debugでデバッグ情報を出せます。あなたのサーバーのパネルのあるチャンネルで実行してみてください。\n' +
        'その情報のスクショがあると解決がスムーズになるかもしれません。\n\n' +
        'それでは、回答をお待ちください。'
    )
}