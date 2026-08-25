import axios from 'axios';
import {AiError, toAiError} from '../errors';
import {AIMessage, AIModel, AIProvider} from '../types';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 60000;
const MAX_OUTPUT_TOKENS = 4096;

type GeminiPart = { text?: string, thought?: boolean };

type GeminiResponse = {
    promptFeedback?: { blockReason?: string },
    candidates?: {
        content?: { parts?: GeminiPart[] },
        finishReason?: string
    }[]
};

function readAnswer(data: GeminiResponse): string {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
        throw new AiError(`Gemini refused the prompt (${blockReason}).`);
    }
    const candidate = data?.candidates?.[0];
    if (!candidate) {
        throw new AiError('Gemini returned an empty response.');
    }
    const text = (candidate.content?.parts ?? [])
        .filter(part => !part.thought)
        .map(part => part.text ?? '')
        .join('')
        .trim();
    if (!text) {
        throw new AiError(`Gemini returned no text (finish reason: ${candidate.finishReason ?? 'unknown'}).`);
    }
    return candidate.finishReason === 'MAX_TOKENS' ? `${text} […]` : text;
}

export class GeminiProvider implements AIProvider {
    readonly id = 'gemini';
    readonly label = 'Gemini';
    readonly apiKeyVariable = 'GEMINI_API_KEY';

    async query(model: AIModel, messages: AIMessage[]): Promise<string> {
        const apiKey = process.env[this.apiKeyVariable];
        if (!apiKey) {
            throw new AiError(`${this.apiKeyVariable} is not set.`);
        }

        // Gemini keeps its system prompt out of the conversation and calls the assistant "model".
        const instructions = messages
            .filter(message => message.role === 'system')
            .map(message => message.content);
        const contents = messages
            .filter(message => message.role !== 'system')
            .map(message => ({
                role: message.role === 'assistant' ? 'model' : 'user',
                parts: [{text: message.content}]
            }));

        const generationConfig: Record<string, unknown> = {
            temperature: model.temperature ?? 1,
            maxOutputTokens: MAX_OUTPUT_TOKENS
        };
        if (model.thinkingLevel) {
            generationConfig.thinkingConfig = {thinkingLevel: model.thinkingLevel};
        }

        try {
            const response = await axios.post<GeminiResponse>(
                `${ENDPOINT}/${model.apiId}:generateContent`,
                {
                    systemInstruction: instructions.length
                        ? {parts: [{text: instructions.join('\n\n')}]}
                        : undefined,
                    contents,
                    generationConfig
                },
                {
                    headers: {'Content-Type': 'application/json', 'x-goog-api-key': apiKey},
                    timeout: REQUEST_TIMEOUT_MS
                }
            );
            return readAnswer(response.data);
        } catch (error) {
            throw toAiError(error, this.label);
        }
    }
}
