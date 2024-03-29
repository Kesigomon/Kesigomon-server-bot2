import {openAIKey, token} from './constant'
import * as discord from 'discord.js'
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

export const client = new discord.Client({
    intents: 2 ** 15 - 1, partials: ['MESSAGE', 'CHANNEL', 'GUILD_MEMBER', 'USER']
});
export const prisma = new PrismaClient();
export const openAI = new OpenAI({
    apiKey: openAIKey
});

process.on('unhandledRejection', ((reason) => {
    console.error(reason)
}))

process.on('SIGTERM', client.destroy);
process.on('SIGINT', client.destroy);

if(require.main === module){
    // client初期化後でないとコグロード不可
    require('./cogs');
    (async () => {
        await client.login(token)
    })()
}

