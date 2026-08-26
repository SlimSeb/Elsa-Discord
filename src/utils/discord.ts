import {GuildTextBasedChannel, Message, TextChannel} from 'discord.js';
import {sleep} from '.';

export type SendableChannel = GuildTextBasedChannel | TextChannel;

export interface SplitOptions {
    maxLength?: number;
    char?: string;
    prepend?: string;
    append?: string;
}

export function splitMessage(text: string, {
    maxLength = 2000,
    char = '\n',
    prepend = '',
    append = ''
}: SplitOptions = {}): string[] {
    if (text.length <= maxLength) {
        return [text];
    }
    const splitText = text.split(char);
    const messages: string[] = [];
    let msg = '';
    for (const chunk of splitText) {
        if (msg && (msg + char + chunk + append).length > maxLength) {
            messages.push(msg + append);
            msg = prepend;
        }
        msg += (msg && msg !== prepend ? char : '') + chunk;
    }
    if (msg) {
        messages.push(msg);
    }
    return messages;
}

// Credit : https://stackoverflow.com/questions/63322284/discord-js-get-an-array-of-all-messages-in-a-channel
export async function fetchAllMessages(channel: TextChannel): Promise<Message<boolean>[]> {
    const messages: Message<boolean>[] = [];

    // Create message pointer
    let msg = await channel.messages
      .fetch({ limit: 1 })
      .then(messagePage => (messagePage.size === 1 ? messagePage.at(0) : null));

    while (msg) {
      const messagePage = await channel.messages
        .fetch({ limit: 100, before: msg.id });
        messagePage.forEach(msg => messages.push(msg));
        // Update our message pointer to be last message in page of messages
        console.log('fetched 100 messages');
        await sleep(1000);
        msg = 0 < messagePage.size ? messagePage.at(messagePage.size - 1) : null;
    }

    console.log('returns '+ messages.length + ' messages');
    return messages;
}

/** Sends a message in order, split across as many Discord messages as its length requires. */
export async function sendLongMessage(
    channel: SendableChannel,
    content: string,
    options: SplitOptions = {maxLength: 2000}
): Promise<void> {
    for (const part of splitMessage(content, options)) {
        await channel.send(part);
    }
}
