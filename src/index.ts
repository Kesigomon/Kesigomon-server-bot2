import {token} from './constant'
import * as discord from 'discord.js'

export const client = new discord.Client({
    intents: 2 ** 15 - 1
});

process.on('unhandledRejection', ((reason) => {
    console.error(reason)
}))

// client初期化後でないとコグロード不可
import './cogs'

(async () => {
    await client.login(token)
})()
