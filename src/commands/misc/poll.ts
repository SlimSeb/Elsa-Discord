import {ClientUser, Message, MessageReaction} from 'discord.js';
import Command from '../../command';
import Context from '../../context';
import Listener from '../../listener';
import {getKeyByValue} from '../../utils';

/**
 * Maps the guild id to the poll instance.
 */
const polls: Map<string, Poll> = new Map();

type EmoteMap = {
    [key: number]: string;
}

export class Poll {
    public static readonly DIGIT_EMOTE_IDS: EmoteMap = {
        0: '1️⃣',
        1: '2️⃣',
        2: '3️⃣',
        3: '4️⃣',
        4: '5️⃣',
        5: '6️⃣',
        6: '7️⃣',
        7: '8️⃣',
        8: '9️⃣',
    };

    /**
     * Message in the guild that the poll was created in.
     */
    private readonly pollCreationMessage: Message<true>;

    private pollMessage: Message | null = null;

    private readonly question: string;

    public readonly options: string[];

    constructor(message: Message<true>, question: string, options: string[]) {
        this.pollCreationMessage = message;
        this.question = question;
        this.options = options;
    }

    get message(): Message | null {
        return this.pollMessage;
    }

    async start(): Promise<void> {
        const pollMessage = await this.pollCreationMessage.channel.send(
            `📊 **${this.question}**\n\n${this.options.map(
                (option, index) => `${Poll.DIGIT_EMOTE_IDS[index]} ${option}`).join('\n')}\n` +
            '_React with the number of the option you want to vote for._'
        );
        this.pollMessage = pollMessage;
        for (let i = 0; i < this.options.length; i++) {
            await pollMessage.react(Poll.DIGIT_EMOTE_IDS[i]);
        }
    }

    async end(): Promise<void> {
        const reactions = await this.pollMessage?.reactions.cache;
        const results: Map<string, number> = new Map();
        let sum = 0;
        for (const reaction of reactions?.values() || []) {
            const value = getKeyByValue(Poll.DIGIT_EMOTE_IDS, reaction.emoji.name);
            if (value == undefined) {
                continue;
            }
            const index = typeof value === 'string' ? Number.parseInt(value) : value;
            results.set(this.options[index], reaction.count - 1);
            sum += reaction.count - 1;
        }
        await this.pollMessage?.delete();
        const [winningOption, maxReactionCount] = [...results]
            .sort((a, b) => b[1] - a[1])[0];
        await this.pollCreationMessage.channel.send(
            `📊 **${this.question}**\n\n` +
            `Winner: **${winningOption}** with **${maxReactionCount}** votes ` +
            `(${(100 * maxReactionCount / sum).toFixed(2)}%)`
        );
    }
}

class CreatePoll extends Command {
    async execute({bot, message, args}: Context): Promise<void> {
        const [question, ...options] = args.split(',').map(s => s.trim());
        if (options.length < 2) {
            await message.channel.send('You need at least two options to create a poll.');
            return;
        }
        if (options.length > 9) {
            await message.channel.send('You can only have up to 10 options in a poll.');
            return;
        }
        if (message.guild && polls.has(message.channelId)) {
            await message.channel.send('There is already a poll running in this channel.');
            return;
        }
        const poll = new Poll(message, question, options);
        polls.set(message.channelId, poll);
        await poll.start();
    }

    name(): string {
        return 'poll-create';
    }

    override aliases(): string[] {
        return ['poll-new'];
    }
}

class EndPoll extends Command {
    async execute({message}: Context): Promise<void> {
        if (!polls.has(message.channelId)) {
            await message.channel.send('There is no poll running in this channel.');
            return;
        }
        const poll = polls.get(message.channelId);
        await poll?.end();
        polls.delete(message.channelId);
    }

    name(): string {
        return 'poll-end';
    }

    override aliases(): string[] {
        return ['poll-stop'];
    }
}

class PollShow extends Command {
    async execute({message}: Context): Promise<void> {
        if (!polls.has(message.channelId)) {
            await message.channel.send('There is no poll running in this channel.');
            return;
        }
        const poll = polls.get(message.channelId);
        await poll?.message?.reply('This is the current poll 📊');
    }

    name(): string {
        return 'poll-show';
    }

    override aliases(): string[] {
        return ['poll-status'];
    }
}

class PollOnReactListener extends Listener {
    constructor() {
        super('messageReactionAdd');
    }

    async onEvent(...args: unknown[]): Promise<void> {
        const [reaction, user] = args as [MessageReaction, ClientUser];
        if (reaction.me) {
            return;
        }
        if (!polls.has(reaction.message.channelId)) {
            return;
        }
        const poll = polls.get(reaction.message.channelId);
        if (!poll || poll.message?.channelId === reaction.message.channelId) {
            return;
        }

        const value = getKeyByValue(Poll.DIGIT_EMOTE_IDS, reaction.emoji.name);
        if (value == undefined) {
            return;
        }
        const index = typeof value === 'string' ? Number.parseInt(value) : value;
        await user.send('You voted for the option: ' + poll.options[index]);
    }
}

export default {
    commands: [CreatePoll, EndPoll, PollShow],
    listeners: [PollOnReactListener],
};
