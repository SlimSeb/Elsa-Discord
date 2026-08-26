import {Message} from 'discord.js';
import {IBot} from './bot';

export default class Context {
    readonly bot: IBot;
    readonly message: Message<true>;
    readonly args: string;
    readonly command: string;

    constructor(bot: IBot, message: Message<true>, args: string, command: string) {
        this.bot = bot;
        this.message = message;
        this.args = args;
        this.command = command;
    }
}
