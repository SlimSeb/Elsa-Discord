import {GeminiProvider} from './providers/gemini';
import {MistralProvider} from './providers/mistral';
import {AIModel} from './types';

const gemini = new GeminiProvider();
const mistral = new MistralProvider();

export const DEFAULT_MODEL_ID = 'gemini-flash';

export const AI_MODELS: AIModel[] = [
    {
        id: 'gemini-flash',
        apiId: 'gemini-3.7-flash',
        provider: gemini,
        thinkingLevel: 'low',
        description: 'Gemini 3.7 Flash, quick and sharp. Default.'
    },
    {
        id: 'gemini-flash-thinking',
        apiId: 'gemini-3.7-flash',
        provider: gemini,
        thinkingLevel: 'high',
        description: 'Gemini 3.7 Flash allowed to think longer. Slower, better at hard questions.'
    },
    {
        id: 'gemini-lite',
        apiId: 'gemini-3.5-flash-lite',
        provider: gemini,
        description: 'Gemini 3.5 Flash Lite, the cheapest option.'
    },
    {
        id: 'gemini-pro',
        apiId: 'gemini-3.1-pro-preview',
        provider: gemini,
        thinkingLevel: 'high',
        description: 'Gemini 3.1 Pro, the strongest one, but tightly rate limited on the free tier.'
    },
    {
        id: 'mistral-small',
        apiId: 'mistral-small-latest',
        provider: mistral,
        description: 'Mistral Small, light and fast.'
    },
    {
        id: 'mistral-medium',
        apiId: 'mistral-medium-latest',
        provider: mistral,
        description: 'Mistral Medium, the balanced Mistral.'
    },
    {
        id: 'mistral-large',
        apiId: 'mistral-large-latest',
        provider: mistral,
        description: 'Mistral Large, the flagship Mistral.'
    }
];

/** Model ids stored by the previous AI system, mapped onto their closest replacement. */
const LEGACY_MODEL_IDS: Record<string, string> = {
    'gemini-2.5-flash': 'gemini-flash',
    'gemini-2.5-flash-lite': 'gemini-lite',
    'gemini-2.5-pro': 'gemini-pro',
    'mistral-small-2506': 'mistral-small',
    'grok': DEFAULT_MODEL_ID,
    'grok-4-latest': DEFAULT_MODEL_ID
};

const modelsById = new Map<string, AIModel>();
for (const model of AI_MODELS) {
    modelsById.set(model.id, model);
    if (!modelsById.has(model.apiId)) {
        modelsById.set(model.apiId, model);
    }
}

export function defaultModel(): AIModel {
    return modelsById.get(DEFAULT_MODEL_ID)!;
}

/** Looks a model up by id, api id or legacy id. Returns undefined when nothing matches. */
export function findModel(id: string | null | undefined): AIModel | undefined {
    if (!id) {
        return undefined;
    }
    const key = id.trim().toLowerCase();
    return modelsById.get(key) ?? modelsById.get(LEGACY_MODEL_IDS[key]);
}

/** Same as findModel, but falls back to the default model instead of failing. */
export function resolveModel(id: string | null | undefined): AIModel {
    const model = findModel(id);
    if (!model && id) {
        console.warn(`Unknown AI model '${id}', falling back to ${DEFAULT_MODEL_ID}.`);
    }
    return model ?? defaultModel();
}

export function modelIds(): string[] {
    return AI_MODELS.map(model => model.id);
}
