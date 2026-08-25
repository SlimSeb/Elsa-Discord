import {IBot} from '../bot';
import {ChatBotPersonality} from '../database/entity/chat-bot-personality';
import {DEFAULT_MODEL_ID} from './models';

export const DEFAULT_PERSONALITY_ID = 'default';

export const defaultPersonality = new ChatBotPersonality(
    DEFAULT_PERSONALITY_ID,
    DEFAULT_MODEL_ID,
    `Tu es Elsa, une IA intégrée à un serveur Discord.
Tes réponses sont concises, pertinentes et teintées d'humour.
Tu écris comme sur Discord : pas de pavé, pas de mise en forme inutile.`
);

/** The personality a guild is currently using, or the built-in one when nothing is selected. */
export async function activePersonality(bot: IBot, guildId: string | null): Promise<ChatBotPersonality> {
    if (!guildId) {
        return defaultPersonality;
    }
    const selectedId = await bot.repository.getSelectedChatBotId(guildId);
    if (!selectedId || selectedId === DEFAULT_PERSONALITY_ID) {
        return defaultPersonality;
    }
    const personality = await bot.repository.getChatBotPersonality(selectedId);
    if (!personality) {
        console.warn(`Selected chat bot '${selectedId}' no longer exists, using the default personality.`);
        return defaultPersonality;
    }
    return personality;
}
