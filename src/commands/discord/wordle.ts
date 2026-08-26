import { Message, TextBasedChannel } from 'discord.js';
import Listener from '../../listener';

export const WORDLE_CHANNEL_ID = '1541925536392020070';
export const WORDLE_APPLICATION_ID = '1211781489931452447';

/**
 * Checks if a message is from the Wordle application (by application ID or bot user ID).
 */
export function isWordleMessage(message: Message): boolean {
    // Only process messages within a guild
    if (!message.guild) {
        return false;
    }

    // Do not forward or delete if it is already in the target channel
    if (message.channelId === WORDLE_CHANNEL_ID) {
        return false;
    }

    // Ignore messages from this bot itself to avoid loops
    if (message.author.id === message.client.user?.id) {
        return false;
    }

    // Check if the message is from the Wordle application
    return message.author.id === WORDLE_APPLICATION_ID ||
        message.applicationId === WORDLE_APPLICATION_ID ||
        (message as unknown as { groupActivityApplication?: { id: string } }).groupActivityApplication?.id === WORDLE_APPLICATION_ID;
}

/**
 * Forwards a Wordle message to the designated channel via Discord's native forward API and deletes the original.
 */
export async function forwardWordleMessage(message: Message): Promise<void> {
    const client = message.client;
    const targetChannel = await client.channels.fetch(WORDLE_CHANNEL_ID).catch(() => null);

    if (!targetChannel || !targetChannel.isTextBased()) {
        console.error(`Wordle forwarding failed: channel ${WORDLE_CHANNEL_ID} not found or is not a text channel.`);
        return;
    }

    try {
        await message.forward(WORDLE_CHANNEL_ID);
    } catch (err) {
        console.error(`Failed to forward Wordle message to channel ${WORDLE_CHANNEL_ID}: ${err}`);
        return;
    }

    try {
        if (message.deletable) {
            await message.delete();
        }
    } catch (err) {
        console.error(`Failed to delete original Wordle message: ${err}`);
    }
}

class WordleForwarderListener extends Listener {
    constructor() {
        super('messageCreate');
    }

    async onEvent(...args: unknown[]): Promise<void> {
        const [message] = args as [Message];
        if (!message || !isWordleMessage(message)) {
            return;
        }
        await forwardWordleMessage(message);
    }
}

export default {
    listeners: [WordleForwarderListener],
};
