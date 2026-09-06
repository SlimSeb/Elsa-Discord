import {
    ChannelType,
    Client,
    Collection,
    GuildChannelCreateOptions,
    Message,
    Snowflake,
    TextChannel
} from 'discord.js';
import Command from '../../command';
import Context from '../../context';
import {sleep} from '../../utils';

/** Discord refuses to bulk-delete anything older than 14 days. */
const MAX_BULK_DELETABLE_AGE = 14 * 24 * 60 * 60 * 1000;
/** Guards against a message ageing past the limit between the fetch and the delete call. */
const BULK_AGE_SAFETY_MARGIN = 60 * 1000;
const PAGE_SIZE = 100;
/** Single deletes have a tight per-channel bucket, so only the >14d path is throttled. */
const OLD_MESSAGE_DELETE_DELAY = 1100;
const PROGRESS_INTERVAL = 4000;
const CONFIRMATION_TIMEOUT = 15000;

const CHANNEL_ID_REGEX = /^(?:<#)?(\d{17,20})>?$/;
const USER_ID_REGEX = /^(?:<@!?)?(\d{17,20})>?$/;

/** Per-channel lock: two cleans on different channels no longer block each other. */
const cleaningChannels = new Set<Snowflake>();
const cancelRequests = new Set<Snowflake>();
const pendingConfirmations = new Map<string, NodeJS.Timeout>();

interface CleanStats {
    scanned: number;
    deleted: number;
    pinned: number;
    failed: number;
    cancelled: boolean;
}

function parseId(input: string, regex: RegExp): Snowflake | null {
    return input.trim().match(regex)?.[1] ?? null;
}

async function resolveTextChannel(client: Client, id: Snowflake): Promise<TextChannel | null> {
    try {
        // fetch(), not cache.get(): the cache misses channels the bot has not seen this session.
        const channel = await client.channels.fetch(id);
        return channel instanceof TextChannel ? channel : null;
    } catch {
        return null;
    }
}

/**
 * Returns true when the caller still has to confirm. The pending entry is keyed by
 * channel *and* user so one person cannot confirm someone else's clean by accident.
 */
function needsConfirmation(key: string): boolean {
    const pending = pendingConfirmations.get(key);
    if (pending) {
        clearTimeout(pending);
        pendingConfirmations.delete(key);
        return false;
    }
    pendingConfirmations.set(key, setTimeout(() => pendingConfirmations.delete(key), CONFIRMATION_TIMEOUT));
    return true;
}

function describe(stats: CleanStats): string {
    const parts = [`Deleted ${stats.deleted} message(s)`, `scanned ${stats.scanned}`];
    if (stats.pinned > 0) {
        parts.push(`${stats.pinned} pinned skipped`);
    }
    if (stats.failed > 0) {
        parts.push(`${stats.failed} failed`);
    }
    return parts.join(', ') + (stats.cancelled ? ' (cancelled)' : '');
}

/**
 * Walks the channel one page at a time and deletes as it goes, instead of buffering every
 * message in memory first. Messages under 14 days old go out in bulk (1 API call per 100).
 */
async function cleanChannel(channel: TextChannel,
                            authorId: Snowflake | null,
                            protectedIds: Set<Snowflake>,
                            onProgress: (stats: CleanStats) => Promise<void>): Promise<CleanStats> {

    const stats: CleanStats = {scanned: 0, deleted: 0, pinned: 0, failed: 0, cancelled: false};
    let before: Snowflake | undefined = undefined;
    let lastProgress = Date.now();

    while (!stats.cancelled) {
        if (cancelRequests.has(channel.id)) {
            stats.cancelled = true;
            break;
        }
        const page: Collection<Snowflake, Message> = await channel.messages.fetch({limit: PAGE_SIZE, before});
        if (page.size === 0) {
            break;
        }
        // Paginate over everything fetched, not just the deletable subset, or filtered-out
        // messages would shift the cursor and skip whole ranges.
        before = page.lastKey();
        stats.scanned += page.size;

        const targets = page.filter(m => {
            if (protectedIds.has(m.id)) {
                return false;
            }
            if (m.pinned) {
                stats.pinned++;
                return false;
            }
            if (authorId && m.author.id !== authorId) {
                return false;
            }
            return m.deletable;
        });

        const cutoff = Date.now() - (MAX_BULK_DELETABLE_AGE - BULK_AGE_SAFETY_MARGIN);
        const [recent, old] = targets.partition(m => m.createdTimestamp > cutoff);

        if (recent.size > 0) {
            try {
                await channel.bulkDelete(recent, true);
                stats.deleted += recent.size;
            } catch (err) {
                console.error(`Bulk delete failed on ${channel.id}, falling back one by one: ${err}`);
                await deleteOneByOne(channel, recent, stats);
            }
        }
        if (old.size > 0) {
            await deleteOneByOne(channel, old, stats);
        }

        if (Date.now() - lastProgress >= PROGRESS_INTERVAL) {
            lastProgress = Date.now();
            await onProgress(stats);
        }
    }
    return stats;
}

async function deleteOneByOne(channel: TextChannel,
                              messages: Collection<Snowflake, Message>,
                              stats: CleanStats): Promise<void> {
    for (const target of messages.values()) {
        if (cancelRequests.has(channel.id)) {
            stats.cancelled = true;
            return;
        }
        try {
            await target.delete();
            stats.deleted++;
        } catch (err) {
            // Already gone, or the bot lost permission mid-run: keep going, do not abort the clean.
            stats.failed++;
            console.error(`Could not delete message ${target.id}: ${err}`);
        }
        await sleep(OLD_MESSAGE_DELETE_DELAY);
    }
}

class CleanChannel extends Command {

    async execute({bot, message, args}: Context): Promise<void> {
        const argsArray = args.split(',').map(arg => arg.trim()).filter(arg => arg.length > 0);
        if (argsArray.length < 1) {
            await message.reply('Please specify a channel to clean.');
            return;
        }
        const channelId = parseId(argsArray[0], CHANNEL_ID_REGEX);
        if (!channelId) {
            await message.reply('Could not read that channel. Give a channel mention or a raw ID.');
            return;
        }
        const channel = await resolveTextChannel(bot.client, channelId);
        if (!channel || channel.guildId !== message.guildId) {
            await message.reply('Please specify a valid text channel in this server.');
            return;
        }

        let authorId: Snowflake | null = null;
        if (argsArray.length >= 2) {
            authorId = parseId(argsArray[1], USER_ID_REGEX);
            if (!authorId) {
                await message.reply('Could not read that user. Give a user mention or a raw ID.');
                return;
            }
        }

        const me = channel.guild.members.me;
        const permissions = me ? channel.permissionsFor(me) : null;
        if (!permissions?.has(['ViewChannel', 'ReadMessageHistory', 'ManageMessages'])) {
            await message.reply(`I need View Channel, Read Message History and Manage Messages in ${channel}.`);
            return;
        }
        if (cleaningChannels.has(channel.id)) {
            await message.reply(`${channel} is already being cleaned. Use \`clean-stop\` to abort it.`);
            return;
        }

        // Claimed synchronously, before the first await, so two invocations cannot both pass the check.
        cleaningChannels.add(channel.id);
        cancelRequests.delete(channel.id);
        bot.isCleaning = true;

        const protectedIds = new Set<Snowflake>([message.id]);
        let progressMsg: Message | null = null;
        const reportProgress = async (stats: CleanStats): Promise<void> => {
            const text = `Cleaning ${channel}: ${describe(stats)}...`;
            try {
                progressMsg = progressMsg ? await progressMsg.edit(text) : await message.channel.send(text);
                protectedIds.add(progressMsg.id);
            } catch (err) {
                // The progress message was deleted: drop it and let the next tick create a new one.
                console.error(`Could not update clean progress: ${err}`);
                progressMsg = null;
            }
        };

        try {
            await reportProgress({scanned: 0, deleted: 0, pinned: 0, failed: 0, cancelled: false});
            const stats = await cleanChannel(channel, authorId, protectedIds, reportProgress);
            await message.reply(`Done cleaning ${channel}. ${describe(stats)}.`);
        } catch (err) {
            console.error(`Clean of ${channel.id} crashed: ${err}`);
            await message.reply(`The clean of ${channel} stopped early: ${err}`).catch(() => null);
        } finally {
            // Without this, one thrown request left isCleaning stuck true until a bot restart.
            cleaningChannels.delete(channel.id);
            cancelRequests.delete(channel.id);
            bot.isCleaning = cleaningChannels.size > 0;
        }
    }

    name(): string {
        return 'clean-channel';
    }

    override isWhiteListOnly(): boolean {
        return true;
    }

    override description(): string {
        return 'Deletes messages in a channel, optionally only those of one user.'
            + ' Syntax: clean-channel <channel>, <user (optional)>';
    }
}

class CleanStop extends Command {

    async execute({message, args}: Context): Promise<void> {
        const channelId = args.trim().length > 0
            ? parseId(args, CHANNEL_ID_REGEX)
            : message.channelId;
        if (!channelId || !cleaningChannels.has(channelId)) {
            await message.reply('No clean is running on that channel.');
            return;
        }
        cancelRequests.add(channelId);
        await message.reply('Stopping the clean after the current batch.');
    }

    name(): string {
        return 'clean-stop';
    }

    override isWhiteListOnly(): boolean {
        return true;
    }

    override description(): string {
        return 'Aborts a running clean-channel. Syntax: clean-stop <channel (optional)>';
    }
}

class TurboClean extends Command {

    async execute({bot, args, message}: Context): Promise<void> {
        const channelId = parseId(args, CHANNEL_ID_REGEX);
        const channel = channelId ? await resolveTextChannel(bot.client, channelId) : null;
        if (!channel || channel.guildId !== message.guildId) {
            await message.reply('Please specify a valid text channel in this server.');
            return;
        }
        if (needsConfirmation(`turbo:${channel.id}:${message.author.id}`)) {
            await message.reply(`Are you sure you want to clean all messages in ${channel}? ` +
                'This will delete the channel then recreate it. If so, redo the command.');
            return;
        }

        const options: GuildChannelCreateOptions = {
            name: channel.name,
            type: ChannelType.GuildText,
            parent: channel.parent ?? undefined,
            position: channel.position,
            nsfw: channel.nsfw,
            topic: channel.topic ?? undefined,
            rateLimitPerUser: channel.rateLimitPerUser,
            // Recreating without these silently reopened private channels to everyone.
            permissionOverwrites: [...channel.permissionOverwrites.cache.values()],
            reason: `turbo-clean by ${message.author.tag}`
        };

        try {
            // Create first, delete second: a failure here leaves the original channel intact.
            const replacement = await channel.guild.channels.create(options);
            await channel.delete(`turbo-clean by ${message.author.tag}`);
            await replacement.setPosition(channel.position).catch(() => null);
            await message.reply(`Recreated ${replacement}.`).catch(() => null);
        } catch (err) {
            console.error(`Turbo clean of ${channel.id} failed: ${err}`);
            await message.reply(`Turbo clean failed: ${err}`).catch(() => null);
        }
    }

    name(): string {
        return 'turbo-clean';
    }

    isMaintainerOnly(): boolean {
        return true;
    }
}

export default {
    commands: [CleanChannel, CleanStop, TurboClean]
};
