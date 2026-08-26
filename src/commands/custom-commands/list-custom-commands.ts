import {DateTime} from 'luxon';
import Command from '../../command';
import Context from '../../context';
import {splitMessage} from '../../utils/discord';

class ListCustomCommand extends Command {
    async execute({bot, message}: Context): Promise<void> {
        if (message.guild === null) {
            return;
        }
        const commands = await bot.repository.getCustomCommands(message.guild.id);
        if (commands.length === 0) {
            await message.channel.send('No custom commands found.');
            return;
        }
        const responses = commands.map(c => `${c.name}: ${c.content}. ` +
            `Créée le ${DateTime.fromFormat(c.createdAt.toString(), 'yyyy-MM-dd')
                .toFormat('dd/MM/yyyy')}`);
        for (const part of splitMessage(
            `\`\`\`${responses.join('\n\n')}\`\`\``,
            {maxLength: 2000, append: '```', prepend: '```'}
        )) {
            await message.channel.send(part);
        }
    }

    name(): string {
        return 'list-custom-commands';
    }

    aliases(): string[] {
        return ['list-custom', 'list-command'];
    }
}

export default {
    commands: [ListCustomCommand],
};
