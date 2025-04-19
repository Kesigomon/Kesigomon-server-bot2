import {client, prisma} from '../index';
import {Message} from 'discord.js';


client.on('messageCreate', async(message) => {
  if(message.author.bot && message.author.username.startsWith("役職パネル")){
    return
  }
  await insertMessage(message)
})

client.on('messageUpdate', async(_, message) => {
  if(message.partial){
    message = await message.fetch();
  }
  await insertMessage(message)
})

const insertMessage = async (message: Message) => {
  const timestamp = message.editedTimestamp
      ? message.editedTimestamp : message.createdTimestamp
  await prisma.message.create({
    data:{
      content: message.content,
      message_id: BigInt(message.id),
      author_id: BigInt(message.author.id),
      channel_id: BigInt(message.channelId),
      timestamp: new Date(timestamp)
    }
  })
}