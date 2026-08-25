import {ask} from '../../ai/chat';
import {DEFAULT_MODEL_ID} from '../../ai/models';
import Command from '../../command';
import Context from '../../context';
import {sendLongMessage} from '../../utils/discord';
import {replyWithError} from './ai-chat';

const FACTOID_SYSTEM_PROMPT = `Tu es un générateur de faits insolites.
À partir d'un message ou d'un sujet donné, génère un fait insolite, surprenant ou amusant qui y est vaguement lié.
Le fait doit être réel et vérifiable. Commence directement par le fait, sans introduction comme "Saviez-vous que..."
ou "Fait intéressant :". Sois concis (1-2 phrases maximum).`;

class RandomFactoid extends Command {
    async execute({message, args}: Context): Promise<void> {
        let content = args?.trim() || null;

        if (!content && message.reference) {
            const referenced = await message.fetchReference();
            content = referenced.content?.trim() || null;
        }
        if (!content) {
            return;
        }

        try {
            await message.channel.sendTyping();
            const factoid = await ask(DEFAULT_MODEL_ID, FACTOID_SYSTEM_PROMPT, `Sujet ou message : "${content}"`);
            await sendLongMessage(message.channel, factoid);
        } catch (error) {
            await replyWithError(message, error);
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
