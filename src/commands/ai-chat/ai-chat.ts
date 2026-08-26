import {Message} from 'discord.js';
import {chat} from '../../ai/chat';
import {conversations} from '../../ai/conversations';
import {AiError} from '../../ai/errors';
import {resolveModel} from '../../ai/models';
import {activePersonality} from '../../ai/personalities';
import Command from '../../command';
import Context from '../../context';
import {sendLongMessage} from '../../utils/discord';

/** Falls back to the replied-to message, so answering a message with the command alone works. */
async function resolvePrompt(message: Message<true>, args: string): Promise<string | null> {
    const prompt = args?.trim();
    if (prompt) {
        return prompt;
    }
    if (message.reference) {
        const referenced = await message.fetchReference();
        return referenced.content?.trim() || null;
    }
    return null;
}

export async function replyWithError(message: Message<true>, error: unknown): Promise<void> {
    if (error instanceof AiError) {
        console.error('AI request failed', error.reason ?? error);
        await message.channel.send(`:warning: ${error.message}`);
        return;
    }
    console.error('Unexpected error during an AI request', error);
    await message.channel.send(':warning: Unexpected error while querying the AI.');
}

class AIChat extends Command {
    async execute({message, args, bot}: Context): Promise<void> {
        const prompt = await resolvePrompt(message, args);
        if (!prompt) {
            await message.channel.send(`Usage: \`${bot.trigger}ai <message>\`, or reply to a message with it.`);
            return;
        }

        try {
            await message.channel.sendTyping();
            const {answer} = await chat(bot, message, prompt);
            await sendLongMessage(message.channel, answer);
        } catch (error) {
            await replyWithError(message, error);
        }
    }

    name(): string {
        return 'ai';
    }

    override aliases(): string[] {
        return ['ask', 'chat'];
    }

    override description(): string {
        return 'Talks to the AI, keeping the context of the channel.';
    }
}

class ResetAIChat extends Command {
    async execute({message}: Context): Promise<void> {
        const forgotten = conversations.clear(message.channelId);
        await message.channel.send(forgotten
            ? `:broom: Forgot ${forgotten} message(s) of AI context in this channel.`
            : 'The AI context of this channel is already empty.');
    }

    name(): string {
        return 'reset-ai';
    }

    override aliases(): string[] {
        return ['ai-reset', 'clear-ai', 'forget'];
    }

    override description(): string {
        return 'Clears the AI conversation context of the channel.';
    }
}

class AIStatus extends Command {
    async execute({message, bot}: Context): Promise<void> {
        const personality = await activePersonality(bot, message.guildId);
        const model = resolveModel(personality.model);
        await message.channel.send([
            `**Chat bot**: \`${personality.id}\``,
            `**Model**: \`${model.id}\` (${model.provider.label}, \`${model.apiId}\`)`,
            `**Context**: ${conversations.size(message.channelId)} message(s) remembered in this channel`
        ].join('\n'));
    }

    name(): string {
        return 'ai-status';
    }

    override aliases(): string[] {
        return ['ai-info', 'current-chat-bot'];
    }

    override description(): string {
        return 'Shows the active chat bot, its model and the size of the channel context.';
    }
}

export default {
    commands: [AIChat, ResetAIChat, AIStatus]
};
