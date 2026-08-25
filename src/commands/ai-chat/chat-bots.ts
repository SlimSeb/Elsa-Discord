import {AI_MODELS, findModel, modelIds, resolveModel} from '../../ai/models';
import {DEFAULT_PERSONALITY_ID, defaultPersonality} from '../../ai/personalities';
import {hasApiKey} from '../../ai/types';
import Command from '../../command';
import Context from '../../context';
import {sendLongMessage} from '../../utils/discord';

const ID_PATTERN = /^[\w-]{1,32}$/;
const KEEP = '-';

/** Splits `a, b, rest with, commas` into exactly `count` parts, the last one keeping its commas. */
function splitArguments(args: string, count: number): string[] {
    const parts = args.split(',');
    return [
        ...parts.slice(0, count - 1).map(part => part.trim()),
        parts.slice(count - 1).join(',').trim()
    ];
}

function unknownModelMessage(model: string): string {
    return `Unknown model \`${model}\`. Available: ${modelIds().map(id => `\`${id}\``).join(', ')}.`;
}

class CreateChatBot extends Command {
    async execute({bot, message, args}: Context): Promise<void> {
        const [rawId, model, systemPrompt] = splitArguments(args, 3);
        const id = rawId.toLowerCase();

        if (!id || !model || !systemPrompt) {
            await message.channel.send(
                `Usage: \`${bot.trigger}create-chat-bot <id>, <model>, <system prompt>\`. ` +
                `Models: \`${bot.trigger}ai-models\`.`);
            return;
        }
        if (!ID_PATTERN.test(id) || id === DEFAULT_PERSONALITY_ID) {
            await message.channel.send('Invalid id: use up to 32 letters, digits, `_` or `-`, and not `default`.');
            return;
        }
        if (!findModel(model)) {
            await message.channel.send(unknownModelMessage(model));
            return;
        }
        if (await bot.repository.getChatBotPersonality(id)) {
            await message.channel.send(`A chat bot named \`${id}\` already exists.`);
            return;
        }

        await bot.repository.saveChatBotPersonality(id, findModel(model)!.id, systemPrompt);
        await message.channel.send(`:white_check_mark: Created chat bot \`${id}\`. ` +
            `Switch to it with \`${bot.trigger}switch-chat-bot ${id}\`.`);
    }

    name(): string {
        return 'create-chat-bot';
    }

    override aliases(): string[] {
        return ['create-chatbot', 'add-chat-bot'];
    }

    override description(): string {
        return 'Creates a chat bot personality: `<id>, <model>, <system prompt>`.';
    }

    override isWhiteListOnly(): boolean {
        return true;
    }
}

class EditChatBot extends Command {
    async execute({bot, message, args}: Context): Promise<void> {
        const [rawId, model, systemPrompt] = splitArguments(args, 3);
        const id = rawId.toLowerCase();

        if (!id || !model || !systemPrompt) {
            await message.channel.send(
                `Usage: \`${bot.trigger}edit-chat-bot <id>, <model>, <system prompt>\`. ` +
                `Use \`${KEEP}\` to keep the current model or prompt.`);
            return;
        }

        const personality = await bot.repository.getChatBotPersonality(id);
        if (!personality) {
            await message.channel.send(`No chat bot named \`${id}\`.`);
            return;
        }
        if (model !== KEEP && !findModel(model)) {
            await message.channel.send(unknownModelMessage(model));
            return;
        }

        const newModel = model === KEEP ? personality.model : findModel(model)!.id;
        const newPrompt = systemPrompt === KEEP ? personality.systemPrompt : systemPrompt;
        await bot.repository.saveChatBotPersonality(personality.id, newModel, newPrompt);
        await message.channel.send(
            `:white_check_mark: Updated \`${personality.id}\` (model: \`${resolveModel(newModel).id}\`).`);
    }

    name(): string {
        return 'edit-chat-bot';
    }

    override aliases(): string[] {
        return ['update-chat-bot', 'edit-chatbot'];
    }

    override description(): string {
        return 'Edits a chat bot: `<id>, <model|->, <system prompt|->`.';
    }

    override isWhiteListOnly(): boolean {
        return true;
    }
}

class DeleteChatBot extends Command {
    async execute({bot, message, args}: Context): Promise<void> {
        const id = args.trim().toLowerCase();
        if (!id) {
            await message.channel.send(`Usage: \`${bot.trigger}delete-chat-bot <id>\`.`);
            return;
        }
        if (!await bot.repository.deleteChatBotPersonality(id)) {
            await message.channel.send(`No chat bot named \`${id}\`.`);
            return;
        }
        // Guilds still pointing at it would silently fall back, so the selection is cleaned up.
        if (message.guildId && await bot.repository.getSelectedChatBotId(message.guildId) === id) {
            await bot.repository.setSelectedChatBotId(message.guildId, null);
        }
        await message.channel.send(`:wastebasket: Deleted chat bot \`${id}\`.`);
    }

    name(): string {
        return 'delete-chat-bot';
    }

    override aliases(): string[] {
        return ['delete-chatbot', 'remove-chat-bot'];
    }

    override description(): string {
        return 'Deletes a chat bot personality.';
    }

    override isWhiteListOnly(): boolean {
        return true;
    }
}

class ListChatBots extends Command {
    async execute({bot, message}: Context): Promise<void> {
        const personalities = await bot.repository.getChatBotPersonalities();
        const activeId = message.guildId
            ? await bot.repository.getSelectedChatBotId(message.guildId) ?? DEFAULT_PERSONALITY_ID
            : DEFAULT_PERSONALITY_ID;

        const lines = [defaultPersonality, ...personalities].map(personality => {
            const model = resolveModel(personality.model);
            const marker = personality.id === activeId ? '>' : ' ';
            const prompt = personality.systemPrompt.replace(/\s+/g, ' ');
            return `${marker} ${personality.id} [${model.id}]\n    ${prompt.substring(0, 200)}` +
                `${prompt.length > 200 ? '…' : ''}`;
        });

        await sendLongMessage(
            message.channel,
            `\`\`\`${lines.join('\n')}\`\`\``,
            {maxLength: 2000, prepend: '```', append: '```'}
        );
    }

    name(): string {
        return 'list-chat-bots';
    }

    override aliases(): string[] {
        return ['list-chatbots', 'chat-bots'];
    }

    override description(): string {
        return 'Lists the chat bot personalities, marking the active one.';
    }
}

class SwitchChatBot extends Command {
    async execute({bot, message, args}: Context): Promise<void> {
        const id = args.trim().toLowerCase();
        if (!id) {
            await message.channel.send(
                `Usage: \`${bot.trigger}switch-chat-bot <id>\`, or \`${DEFAULT_PERSONALITY_ID}\` to go back.`);
            return;
        }
        if (!message.guildId) {
            await message.channel.send('Chat bots can only be switched inside a server.');
            return;
        }

        if (id === DEFAULT_PERSONALITY_ID) {
            await bot.repository.setSelectedChatBotId(message.guildId, null);
            await message.channel.send(':arrows_counterclockwise: Back to the default chat bot.');
            return;
        }

        const personality = await bot.repository.getChatBotPersonality(id);
        if (!personality) {
            await message.channel.send(`No chat bot named \`${id}\`. See \`${bot.trigger}list-chat-bots\`.`);
            return;
        }

        await bot.repository.setSelectedChatBotId(message.guildId, personality.id);
        await message.channel.send(
            `:arrows_counterclockwise: Switched to \`${personality.id}\` ` +
            `(\`${resolveModel(personality.model).id}\`). ` +
            `Run \`${bot.trigger}reset-ai\` to start from a clean context.`);
    }

    name(): string {
        return 'switch-chat-bot';
    }

    override aliases(): string[] {
        return ['switch-chatbot', 'set-chat-bot'];
    }

    override description(): string {
        return 'Switches the chat bot personality used on this server.';
    }

    override isWhiteListOnly(): boolean {
        return true;
    }
}

class AIModels extends Command {
    async execute({message}: Context): Promise<void> {
        const lines = AI_MODELS.map(model => {
            const missingKey = hasApiKey(model.provider) ? '' : ` (no ${model.provider.apiKeyVariable})`;
            return `\`${model.id}\` — ${model.description}${missingKey}`;
        });
        await sendLongMessage(message.channel, `**Available models**\n${lines.join('\n')}`);
    }

    name(): string {
        return 'ai-models';
    }

    override aliases(): string[] {
        return ['models', 'list-models'];
    }

    override description(): string {
        return 'Lists the AI models a chat bot can use.';
    }
}

export default {
    commands: [CreateChatBot, EditChatBot, DeleteChatBot, ListChatBots, SwitchChatBot, AIModels]
};
