import {Client, GatewayIntentBits, Partials} from 'discord.js';
import {loadPlugins} from './src/command-loader';
import dotenv from 'dotenv';
import {Bot} from './src/bot';
import {BotRepository} from './src/database';

dotenv.config();

async function run() {
    const [commands, listeners] = await loadPlugins();
    const repository = new BotRepository();
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.MessageContent,
        ],
        partials: [
            Partials.Channel,
            Partials.Message,
            Partials.Reaction,
        ],
    });
    const bot = new Bot(client, commands, process.env.TRIGGER ?? '!', repository);
    bot.addListeners(listeners);

    client.on('ready', bot.onReady.bind(bot));
    client.on('messageCreate', bot.onMessageCreate.bind(bot));

    await client.login(process.env.DISCORD_TOKEN);
}

run();
