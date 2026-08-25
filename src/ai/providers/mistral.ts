import axios from 'axios';
import {AiError, toAiError} from '../errors';
import {AIMessage, AIModel, AIProvider} from '../types';

const ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 60000;
const MAX_TOKENS = 2048;

type MistralResponse = {
    choices?: { message?: { content?: string }, finish_reason?: string }[]
};

/** Mistral expects a single leading system message, so scattered instructions are merged. */
function toMistralMessages(messages: AIMessage[]): AIMessage[] {
    const instructions = messages
        .filter(message => message.role === 'system')
        .map(message => message.content);
    const conversation = messages.filter(message => message.role !== 'system');
    return instructions.length
        ? [{role: 'system', content: instructions.join('\n\n')}, ...conversation]
        : conversation;
}

export class MistralProvider implements AIProvider {
    readonly id = 'mistral';
    readonly label = 'Mistral';
    readonly apiKeyVariable = 'MISTRAL_API_KEY';

    async query(model: AIModel, messages: AIMessage[]): Promise<string> {
        const apiKey = process.env[this.apiKeyVariable];
        if (!apiKey) {
            throw new AiError(`${this.apiKeyVariable} is not set.`);
        }

        try {
            const response = await axios.post<MistralResponse>(
                ENDPOINT,
                {
                    model: model.apiId,
                    messages: toMistralMessages(messages),
                    temperature: model.temperature ?? 0.7,
                    // eslint-disable-next-line camelcase
                    max_tokens: MAX_TOKENS
                },
                {
                    headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`},
                    timeout: REQUEST_TIMEOUT_MS
                }
            );
            const choice = response.data.choices?.[0];
            const text = choice?.message?.content?.trim();
            if (!text) {
                throw new AiError('Mistral returned an empty response.');
            }
            return choice?.finish_reason === 'length' ? `${text} […]` : text;
        } catch (error) {
            throw toAiError(error, this.label);
        }
    }
}
