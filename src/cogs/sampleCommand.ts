import { ChatInputApplicationCommandData } from 'discord.js';
import {client} from '../index';

const commands: ChatInputApplicationCommandData[] = [
    {
        name: 'plan1',
        description: 'テストのコマンドです'
    },
    {
        name: 'plan2',
        description: 'テストのコマンドです'
    }
]

client.once('ready', async(client)=>{
    const guildId = client.guilds.cache.firstKey();
    if(!guildId){
        return;
    }
    for(const command of commands){
        await client.application.commands.create(command)
    }   
})
 
client.on('interactionCreate', async (interaction) => {
    if (
        !interaction.inCachedGuild() 
        || !interaction.isCommand()
    ){
        return;
    }
    switch(interaction.commandName){
        case 'plan1':
            await interaction.deferReply({ephemeral: true, fetchReply: true})
            await interaction.editReply(
                "コマンドの動作が正常に完了しました。\n"
                + "plan1は、コマンドのreplyをephemeralとし、コマンドの結果が無ければinteractionのReplyをこんな感じに編集します\n"
                + "コマンドの結果があれば、その結果に編集します。"
            )
            break
        case 'plan2':
            await interaction.deferReply({ephemeral: false, fetchReply: true})
            await interaction.deleteReply()
            await interaction.followUp({
                content: "コマンドの結果があれば、ここに表示されます\n"
                + "plan2は、コマンドのreplyにephemeralを使わず（全員に表示される）、コマンドの実行が終了したらそのreplyは削除します。\n"
                + "コマンドの結果があればこのようにfollowUpをephemeralで使います。",
                ephemeral: true
            })
    }
})