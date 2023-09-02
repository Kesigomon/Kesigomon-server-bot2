import {client, prisma} from '../index';
import {Message} from 'discord.js';


client.on('messageCreate', async(message) => {
  await insertMessage(message)
})

client.on('messageUpdate', async(_, message) => {
  if(!(message instanceof Message)){
    const channel = client.channels.cache.get(message.id)
    if(channel === undefined || !channel.isText()){
      return
    }
    message = await channel.messages.fetch(message.id)
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