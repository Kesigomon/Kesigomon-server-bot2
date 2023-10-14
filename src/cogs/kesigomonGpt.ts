import {client, openAI} from '../index';
import {kesigomonGptChannelId, openAIModelId} from '../constant';
import {Chat} from 'openai/resources';
import ChatCompletionMessageParam = Chat.ChatCompletionMessageParam;
import {DiscordAPIError} from 'discord.js';

const systemPrompt =
    "あなたはケシゴモンです。Discordからメッセージか来るので、ケシゴモンの特徴をもとに回答してください。\n" +
    "\n" +
    "特徴\n" +
    "すべてタメ口で話し、丁寧語などは使いません。\n" +
    "\n" +
    "プログラミングは以下の技術スタックを知っています。以下の技術に関する質問であれば答えて良いです。逆に以下に上がってない技術は答えられない旨を伝えてください。\n" +
    "C、C++、Java、Kotlin、Rust、Haskell、Python、Javascript、TypesScript、Go、Windows、Linux\n" +
    "\n" +
    "\n" +
    "すべてタメ口で話し、丁寧語などは使いません。\n" +
    "\n" +
    "嫁は羽黒で妹はチノで相棒はキィランです。\n" +
    "\n" +
    "スーパー戦隊と仮面ライダーが好きです。"
client.on('messageCreate', async(message) => {
  if(!client.isReady() || message.author.bot || message.channelId !== kesigomonGptChannelId){
    return
  }
  const messages: ChatCompletionMessageParam[] = []
  let current = message;
  while(current){
    const role = current.author.id === client.user!.id ? "assistant" : "user";
    messages.push({
      role: role,
      content: current.content
    })
    if(!current.reference?.messageId){
      break
    }
    try{
      current = await message.channel.messages.fetch(current.reference?.messageId);
    }
    catch (e) {
      if (e instanceof DiscordAPIError){
        break
      }
      throw e
    }
  }
  messages.push({role: 'system', content: systemPrompt})
  messages.reverse()
  let text = "";
  while(true){
    const completion = await openAI.chat.completions.create({
      model: openAIModelId ?? "gpt-3.5-turbo-0613",
      messages: messages,
      stream: false,
      temperature: 0,
      max_tokens: 2048,
    }).then((c) => c.choices[0]);
    const reason = completion.finish_reason;
    if(reason === "stop"){
      text += completion.message.content;
      break
    }
    else if(reason === "length") {
      text += completion.message.content;
      if (messages[messages.length - 1].role === "assistant") {
        messages[messages.length - 1].content = text;
      }
      else{
        messages.push({role: "assistant", content: text})
      }
    }
    else if(reason === "content_filter"){
      await message.reply({content: "にゃーん（社会性フィルター）", allowedMentions: {parse: []}})
      return;
    }
    else{
      await message.reply({content: "エラーが発生しました。", allowedMentions: {parse: []}})
      return;
    }
  }
  await message.reply({content: text, allowedMentions: {parse: []}})
});