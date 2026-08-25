import axios from 'axios';

/** An error whose message is safe to display as-is in Discord. */
export class AiError extends Error {
    readonly reason: unknown;

    constructor(message: string, reason?: unknown) {
        super(message);
        this.name = 'AiError';
        this.reason = reason;
    }
}

function extractDetail(data: unknown): string | undefined {
    if (!data || typeof data !== 'object') {
        return undefined;
    }
    const payload = data as { error?: { message?: string } | string, message?: string, detail?: string };
    if (typeof payload.error === 'string') {
        return payload.error;
    }
    return payload.error?.message ?? payload.message ?? payload.detail;
}

/** Turns anything thrown by a provider into an AiError with a message worth showing to a user. */
export function toAiError(error: unknown, providerLabel: string): AiError {
    if (error instanceof AiError) {
        return error;
    }
    if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
            return new AiError(`${providerLabel} took too long to answer.`, error);
        }
        const status = error.response?.status;
        if (status === 401 || status === 403) {
            return new AiError(`${providerLabel} rejected the API key (HTTP ${status}).`, error);
        }
        if (status === 429) {
            return new AiError(`${providerLabel} rate limit reached, try again in a moment.`, error);
        }
        if (status && status >= 500) {
            return new AiError(`${providerLabel} is unavailable right now (HTTP ${status}).`, error);
        }
        return new AiError(`${providerLabel} error: ${extractDetail(error.response?.data) ?? error.message}`, error);
    }
    return new AiError(`Unexpected error while querying ${providerLabel}.`, error);
}
