import {token} from './constant'
import * as discord from 'discord.js'

export const client = new discord.Client({
    intents: 2 ** 15 - 1
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

