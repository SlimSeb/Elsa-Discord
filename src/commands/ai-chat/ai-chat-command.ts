import { GuildTextBasedChannel, Message, Util } from "discord.js";
import Command from "../../command";
import Context from "../../context";
import axios from "axios";
import { AIConversation, supportedAiProviders } from './ai-provider';
import { ChatBotPersonality } from "../../database/entity/conversation-context";

const conversations: Map<string, AIConversation> = new Map();

function buildServerContext(message: Message): string {
    const guild = message.guild!;

    return `
Server name: ${guild.name}
Channel name: ${(message.channel as GuildTextBasedChannel)?.name}
User invoking command: ${message.author.username}
`.trim();
}

const defaultChatBotPersonality = new ChatBotPersonality(
    'default',
    `
Tu es une assistante IA intelligente et amusante nommée Elsa, intégrée dans un serveur Discord. 
Tes réponses doivent être concises, pertinentes et empreintes d\'une touche d\'humour.`.trim(),
    'gemini-2.5-flash'
);

class AIChat extends Command {
    async execute({message, args, bot}: Context): Promise<void> {
        if (!args) {
            await message.channel.send('Please provide a message for the AI.');
            return;
        }

        const usedChatBot = bot.currentChatBots.get(message.guildId!);
        if (usedChatBot) {
            console.log(`Using chat bot ID from currentChatBots map: ${usedChatBot}`);
        }

        let chatBot: ChatBotPersonality;
        if (usedChatBot) {
            const fetchedChatBot = await bot.repository.getChatBotPersonality(usedChatBot);
            if (fetchedChatBot) {
                chatBot = fetchedChatBot;
            } else {
                console.log(`No chat bot personality found with ID: ${usedChatBot}, falling back to default.`);
                chatBot = defaultChatBotPersonality;
            }
        } else {
            console.log('No chat bot ID set for this guild, using default chat bot personality.');
            chatBot = defaultChatBotPersonality;

        } 
        let conversation = conversations.get(message.channelId);

        // If the conversation has more than 5 messages, remove the oldest user/assistant pair
        if (conversation && conversation.messages.length > 5) {
            const firstUserIndex = conversation.messages.findIndex(m => m.role === 'user');
            if (firstUserIndex !== -1) {
                conversation.messages.splice(firstUserIndex, 1);
                if (conversation.messages[firstUserIndex] && conversation.messages[firstUserIndex].role === 'assistant') {
                    conversation.messages.splice(firstUserIndex, 1);
                }
            }
        }

        if (!conversation) {
            conversation = {
                messages: [
                    {
                        role: 'system',
                        content: chatBot.systemPrompt
                    },
                    {
                        role: 'system',
                        content: buildServerContext(message)
                    }
                ]
            };
            conversations.set(message.channelId, conversation);
        }

        conversation.messages.push({
            role: 'user',
            content: args
        });

        const systemMessages = conversation.messages.filter(m => m.role === 'system');
        const nonSystemMessages = conversation.messages.filter(m => m.role !== 'system').slice(-20);
        conversation.messages = [...systemMessages, ...nonSystemMessages];

        try {
            const aiProvider = supportedAiProviders.get(chatBot.provider.trim())!;
            console.log({aiProvider, supportedAiProviders})
            console.log(`Using AI Provider: '${chatBot.provider}' with system prompt: ${chatBot.systemPrompt}`);
            const aiResponse = await aiProvider.queryAI(conversation.messages);
    
            conversation.messages.push({
                role: 'assistant',
                content: aiResponse
            });
    
            Util.splitMessage(aiResponse, {maxLength: 2000}).forEach(async part => {
                await message.channel.send(part);
            }
            );
        } catch (error) {
            if (axios.isAxiosError(error)) {
                await message.channel.send(`Error querying AI: ${error.response?.data?.error?.message || error.message}`);
            } else {
                console.error('Unexpected error', error);
                await message.channel.send('An unexpected error occurred while querying the AI.');
            }
        }
    }

    name(): string {
        return 'ai';
    }

    override aliases(): string[] {
        return ['ask', 'chat'];
    }
}

class ResetAIChat extends Command {
    async execute({message}: Context): Promise<void> {
        conversations.delete(message.channelId);
        await message.channel.send('AI conversation has been reset for this channel.');
    }
    
    name(): string {
        return 'reset-ai';
    }
}


export default {
    commands: [AIChat, ResetAIChat]
};
