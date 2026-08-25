import {AIMessage} from './types';

/** Kept small on purpose: Discord chats drift fast and every message is resent to the provider. */
const MAX_STORED_MESSAGES = 24;
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

type Conversation = {
    messages: AIMessage[],
    updatedAt: number
};

/**
 * Per channel chat history, in memory only. It holds nothing but user and assistant turns: the
 * system prompt is rebuilt on every request, so switching personality or model applies at once.
 */
class ConversationStore {
    private readonly conversations = new Map<string, Conversation>();

    private live(channelId: string): Conversation | undefined {
        const conversation = this.conversations.get(channelId);
        if (!conversation) {
            return undefined;
        }
        if (Date.now() - conversation.updatedAt > IDLE_TIMEOUT_MS) {
            this.conversations.delete(channelId);
            return undefined;
        }
        return conversation;
    }

    history(channelId: string): AIMessage[] {
        return this.live(channelId)?.messages ?? [];
    }

    size(channelId: string): number {
        return this.history(channelId).length;
    }

    remember(channelId: string, ...messages: AIMessage[]): void {
        const conversation = this.live(channelId) ?? {messages: [], updatedAt: Date.now()};
        conversation.messages = [...conversation.messages, ...messages].slice(-MAX_STORED_MESSAGES);
        conversation.updatedAt = Date.now();
        this.conversations.set(channelId, conversation);
    }

    /** Drops the channel history and returns how many messages were forgotten. */
    clear(channelId: string): number {
        const size = this.size(channelId);
        this.conversations.delete(channelId);
        return size;
    }
}

export const conversations = new ConversationStore();
