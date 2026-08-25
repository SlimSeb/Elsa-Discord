import {Message, SplitOptions, TextBasedChannel, TextChannel, Util} from 'discord.js';
import {sleep} from '.';

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
    channel: TextBasedChannel,
    content: string,
    options: SplitOptions = {maxLength: 2000}
): Promise<void> {
    for (const part of Util.splitMessage(content, options)) {
        await channel.send(part);
    }
}
