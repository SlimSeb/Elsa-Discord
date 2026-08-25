import {Message} from 'discord.js';
import jsep, {Expression} from 'jsep';
import {DateTime} from 'luxon';
import Listener from '../../listener';
import {choice, shuffle} from '../../utils/rand';
import {IBot} from '../../bot';

type FunctionMap = {
    [key: string]: CallableFunction;
};

function parseContent(content: string, evaluate: (node: Expression) => unknown) {
    const matches = content.match(/({[^}]+})/g) ?? [];
    for (const match of matches) {
        const expression = match.substring(1, match.length - 1);
        const node = jsep(expression);
        const result = evaluate(node);
        content = content.replace(match, (result as object).toString());
    }
    return content;
}

export async function parseCustomCommand(bot: IBot, message: Message) {
    if (message.guild === null) {
        return;
    }
    if (!message.content.startsWith(bot.trigger ?? '')) {
        return;
    }
    if (message.author.id === bot.client.user?.id) {
        return;
    }
    const command = message
        .content
        .substring(bot.trigger?.length ?? 0)
        .split(' ')[0];
    if (bot.commands.has(command)) {
        return;
    }
    const commandArgs = message
        .content
        .substring((bot.trigger?.length ?? 0) + command.length + 1);

    const whitelistUserIds = process.env.WHITELIST?.split(';') ?? [];
    if (!whitelistUserIds.includes(message.author.id)) {
        return;
    }

    const predefinedFunctions: FunctionMap = {
        'choice': (...args: string[]): string => choice(args),
        'dice': (a: number, b: number): number => Math.floor(Math.random() * (b - a + 1)) + a,
        'repeat': (expr: string, count: number): string => new Array(count).fill(expr).join(''),
        'optional': (expr: string, probability: number): string =>
            Math.random() < probability ? expr : '',
        'randomDate': (start: string, end: string): string => {
            const startDate = DateTime.fromFormat(start, 'dd/MM/yyyy');
            const endDate = DateTime.fromFormat(end, 'dd/MM/yyyy');
            return DateTime.local()
                .set({
                    year: startDate.year,
                    month: startDate.month,
                    day: startDate.day,
                })
                .plus({
                    days: Math.floor(Math.random() * (endDate.diff(startDate).as('days') + 1)),
                })
                .toFormat('dd/MM/yyyy');
        },
        'listOf': (...args: string[]): string[] => args,
        'sampleFrom': (args: string[], count: number, separator: string): string => {
            const shuffledArgs = shuffle(args);
            return new Array(count).fill('').map(() => shuffledArgs.pop()).join(separator);
        },
        'shuffle': (...args: string[]): string[] => shuffle(args),
        'join': (args: string[], separator: string): string => args.join(separator),
        'cos': (value: number): number => Math.cos(value),
        'sin': (value: number): number => Math.sin(value),
        'tan': (value: number): number => Math.tan(value),
        'acos': (value: number): number => Math.acos(value),
        'asin': (value: number): number => Math.asin(value),
        'atan': (value: number): number => Math.atan(value),
        'atan2': (y: number, x: number): number => Math.atan2(y, x),
        'round': (value: number, fractionDigits: number): string => value.toFixed(fractionDigits),
        'iif': (expression: boolean, valueIfTrue: unknown, valueIfFalse: unknown): unknown => {
            return expression ? valueIfTrue : valueIfFalse;
        }
    };

    const binaryOperators: FunctionMap = {
        '+': (a: number, b: number): number => a + b,
        '-': (a: number, b: number): number => a - b,
        '*': (a: number, b: number): number => a * b,
        '/': (a: number, b: number): number => a / b,
        '%': (a: number, b: number): number => a % b,
        '**': (a: number, b: number): number => a ** b,
        '&&': (a: boolean, b: boolean): boolean => a && b,
        '||': (a: boolean, b: boolean): boolean => a || b,
    };

    const predefinedIdentifiers: FunctionMap = {
        'command': (): string => command,
        'author': (): string => message.author.toString(),
        'channel': (): string => message.channel.toString(),
        'guild': (): string => message.guild!.toString(),
        'args': (): string => parseContent(commandArgs, evaluate),
        'randMember': (): string => choice([...message.guild!.members.cache.values()]
            .map(t => t?.displayName ?? '')).toString(),
        'pi': (): number => Math.PI,
        'e': (): number => Math.E,
    };

    const evaluate = (node: Expression): unknown => {
        if (node.type === 'Literal') {
            return node.value;
        }
        if (node.type === 'CallExpression') {
            const functionNode = node.callee as Expression;
            const functionName = functionNode.name as string;
            const functionArgs = (node!.arguments as Expression[]).map(evaluate);
            if (predefinedFunctions[functionName]) {
                return predefinedFunctions[functionName](...functionArgs);
            }
            throw new Error(`Could not find function ${functionName}`);
        }
        if (node.type === 'BinaryExpression') {
            const left = evaluate(node.left as Expression);
            const right = evaluate(node.right as Expression);
            const operator = node.operator as string;
            if (binaryOperators[operator]) {
                return binaryOperators[operator](left, right);
            }
            throw new Error(`Could not evaluate binary expression ${node.operator}`);
        }
        if (node.type === 'Identifier') {
            const identifier = node.name as string;
            if (predefinedIdentifiers[identifier]) {
                return predefinedIdentifiers[identifier]();
            }
            throw new Error(`Could not find identifier ${identifier}`);
        }
    };

    const customCommand = await bot.repository.getCustomCommand(message.guild.id, command);
    if (!customCommand) {
        return;
    }
    try {
        let content = customCommand.content;
        content = parseContent(content, evaluate);
        await message.channel.send(content);
    } catch (error) {
        await message.channel
            .send(`Error while evaluating custom command ${command}: \`\`\`${error}\`\`\``);
    }
}

class CustomCommandListener extends Listener {
    constructor() {
        super('messageCreate');
    }

    async onEvent(...args: unknown[]): Promise<void> {
        const [message] = args as [Message];
        await parseCustomCommand(this.bot!, message);
    }
}

export default {
    listeners: [CustomCommandListener],
};
