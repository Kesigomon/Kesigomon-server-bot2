import {client} from '../index'

const pattern = /[\w\-]{22,28}\.[\w\-]{4,8}\.[\w\-]{26,30}/;

client.on("messageCreate", async (message)=>{
    if(pattern.test(message.content)){
        await message.delete()
        await message.member?.ban({
            reason: "トークンと思わしきメッセージ送信のため"
        })
    }
})