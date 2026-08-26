import Command from '../../command';
import Context from '../../context';
import {Dex} from '@pkmn/dex';
import {choice} from '../../utils/rand';
import {MessageReplyOptions} from 'discord.js';

class RandPoke extends Command {
    async execute({message}: Context): Promise<void> {
        const pokemon = choice(Dex.species.all());
        const stats = pokemon.baseStats;
        const messageOptions: MessageReplyOptions = {
            content: `**${pokemon.name}** (n°${pokemon.num})
            Type: ${pokemon.types.join('/')}
            Talents: ${Object.values(pokemon.abilities).join('/')}
            Poids: ${pokemon.weightkg} kg
            Stats: ${stats.hp}/${stats.atk}/${stats.def}/${stats.spa}/${stats.spd}/${stats.spe}
          `,
        };
        await message.reply(messageOptions);
    }

    name(): string {
        return 'randpoke';
    }
}

export default {
    commands: [RandPoke]
};
