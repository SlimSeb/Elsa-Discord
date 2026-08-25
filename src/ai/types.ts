export type AIRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
    role: AIRole;
    content: string;
}

/**
 * A model as exposed to users. The id is stable and stored in the database, while apiId is the
 * versioned id sent to the provider, so bumping a model does not break existing personalities.
 */
export interface AIModel {
    readonly id: string;
    readonly apiId: string;
    readonly provider: AIProvider;
    readonly description: string;
    /** Gemini 3 only: how long the model is allowed to think before answering. */
    readonly thinkingLevel?: 'low' | 'high';
    readonly temperature?: number;
}

export interface AIProvider {
    readonly id: string;
    readonly label: string;
    readonly apiKeyVariable: string;

    query(model: AIModel, messages: AIMessage[]): Promise<string>;
}

export function hasApiKey(provider: AIProvider): boolean {
    return !!process.env[provider.apiKeyVariable];
}
