import {GuildTextBasedChannel, Message} from 'discord.js';
import {DateTime} from 'luxon';
import {IBot} from '../bot';
import {conversations} from './conversations';
import {resolveModel} from './models';
import {activePersonality} from './personalities';
import {AIMessage} from './types';

function serverContext(message: Message): string {
    return [
        `Serveur : ${message.guild?.name ?? 'message privé'}`,
        `Salon : ${(message.channel as GuildTextBasedChannel)?.name ?? 'privé'}`,
        `Utilisateur : ${message.member?.displayName ?? message.author.username}`,
        `Date : ${DateTime.now().setLocale('fr').toFormat('cccc d LLLL yyyy, HH:mm')}`
    ].join('\n');
}

export type ChatResult = {
    answer: string,
    personalityId: string,
    modelId: string
};

/**
 * One chat turn: personality, channel history and prompt in, answer out. The history is only
 * updated once the provider answered, so a failed request never poisons the context.
 */
export async function chat(bot: IBot, message: Message, prompt: string): Promise<ChatResult> {
    const personality = await activePersonality(bot, message.guildId);
    const model = resolveModel(personality.model);
    const question: AIMessage = {role: 'user', content: prompt};
    const messages: AIMessage[] = [
        {role: 'system', content: personality.systemPrompt},
        {role: 'system', content: serverContext(message)},
        ...conversations.history(message.channelId),
        question
    ];

    const answer = await model.provider.query(model, messages);
    conversations.remember(message.channelId, question, {role: 'assistant', content: answer});
    return {answer, personalityId: personality.id, modelId: model.id};
}

/** A single question with no history, for commands that just need one answer. */
export async function ask(modelId: string, systemPrompt: string, prompt: string): Promise<string> {
    const model = resolveModel(modelId);
    return model.provider.query(model, [
        {role: 'system', content: systemPrompt},
        {role: 'user', content: prompt}
    ]);
}
