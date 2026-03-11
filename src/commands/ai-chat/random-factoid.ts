import { Util } from "discord.js";
import Command from "../../command";
import Context from "../../context";
import axios from "axios";
import { AIMessage, supportedAiProviders } from './ai-provider';

const FACTOID_SYSTEM_PROMPT = `Tu es un générateur de faits insolites.
À partir d'un message ou d'un sujet donné, génère un fait insolite, surprenant ou amusant qui y est vaguement lié.
Le fait doit être réel et vérifiable. Commence directement par le fait, sans introduction comme "Saviez-vous que..." ou "Fait intéressant :".
Sois concis (1-2 phrases maximum).`;

async function getFactoidForContent(content: string): Promise<string> {
    const provider = supportedAiProviders.get('gemini-2.5-flash')!;
    console.log({content, provider});
    const messages: AIMessage[] = [
        { role: 'system', content: FACTOID_SYSTEM_PROMPT },
        { role: 'user', content: `Sujet ou message : "${content}"` }
    ];
    return provider.queryAI(messages);
}

class RandomFactoid extends Command {
    async execute({ message, args }: Context): Promise<void> {
        let content: string | null = args?.trim() || null;

        if (!content && message.reference) {
            const referenced = await message.fetchReference();
            content = referenced.content || null;
        }

        if (!content) {
            // await message.channel.send('Donne-moi un sujet ou réponds à un message pour que je génère un fait insolite !');
            return;
        }

        try {
            const factoid = await getFactoidForContent(content);
            Util.splitMessage(`${factoid}`, { maxLength: 2000 }).forEach(async part => {
                await message.channel.send(part);
            });
        } catch (error) {
            if (axios.isAxiosError(error)) {
                await message.channel.send(`Erreur lors de la génération du fait : ${error.response?.data?.error?.message || error.message}`);
            } else {
                console.error('Unexpected error in RandomFactoid', error);
                await message.channel.send('Une erreur inattendue est survenue.');
            }
        }
    }

    name(): string {
        return 'factoid';
    }

    override aliases(): string[] {
        return ['fact', 'random-fact', 'test', 'cassdel'];
    }

    override description(): string {
        return 'Génère un fait insolite vaguement lié au contenu d\'un message.';
    }
}

export default {
    commands: [RandomFactoid]
};
