import {Client, Message} from 'discord.js';
import Command from './command';
import Context from './context';
import './database';
import {IBotRepository} from './database';
import Listener from './listener';

export type CommandCollection = Map<string, Command>;

export interface IBot {
    trigger: string;
    client: Client;
    commands: CommandCollection;
    repository: IBotRepository;
    isCleaning: boolean;
    snapChatsChannels: Map<string, Message[]>;

    addListeners(listener: Listener[]): void;

    removeAllListeners(): void;
}

export class Bot implements IBot {

    readonly client: Client;
    readonly trigger: string;
    readonly repository: IBotRepository;
    commands: CommandCollection;

    isCleaning = false;
    snapChatsChannels = new Map<string, Message[]>();

    constructor(client: Client,
                commands: CommandCollection,
                trigger: string,
                repository: IBotRepository) {

        this.client = client;
        this.commands = commands;
        this.trigger = trigger;
        this.repository = repository;
    }

    addListener(event: string, listener: Listener) {
        this.client.on(event, listener.onEvent.bind(listener));
    }

    addListeners(listeners: Listener[]) {
        for (const listener of listeners) {
            listener.bot = this;
            this.addListener(listener.event, listener);
        }
    }

    removeAllListeners() {
        this.client.removeAllListeners();
    }

    onReady() {
        console.log(`Logged in as ${this.client.user?.tag}!`);
    }

    async onMessageCreate(message: Message) {
        if (message.author.bot || message.author.id === this.client.user?.id) {
            return;
        }
        if (!message.content.startsWith(this.trigger)) {
            return;
        }

        const command = message
            .content
            .substring(this.trigger.length)
            .split(' ')[0]
            .trim();
        const args = message
            .content
            .substring(this.trigger.length + command.length + 1)
            .trim();

        if (this.commands.has(command)) {
            const commandInstance = this.commands.get(command);
            try {
                if (commandInstance?.canExecute(message.member)) {
                    await commandInstance.execute(new Context(this, message, args, command));
                }
            } catch (e) {
                console.error('Command execution crashed: '+ e);
            }
        }
    }
}
