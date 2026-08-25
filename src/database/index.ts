import 'reflect-metadata';
import {DataSource, EntityTarget, ObjectLiteral, Repository} from 'typeorm';
import {ChatBotPersonality} from './entity/chat-bot-personality';
import {CustomCommand} from './entity/custom-command';
import {GuildAiSettings} from './entity/guild-ai-settings';

export interface IBotRepository {
    getCustomCommands(guild: string): Promise<CustomCommand[]>;

    getCustomCommand(guild: string, name: string): Promise<CustomCommand | null>;

    createCustomCommand(guild: string, name: string, content: string): Promise<CustomCommand>;

    deleteCustomCommand(guild: string, name: string): Promise<boolean>;

    getChatBotPersonalities(): Promise<ChatBotPersonality[]>;

    getChatBotPersonality(id: string): Promise<ChatBotPersonality | null>;

    saveChatBotPersonality(id: string, model: string | null, systemPrompt: string): Promise<ChatBotPersonality>;

    deleteChatBotPersonality(id: string): Promise<boolean>;

    getSelectedChatBotId(guild: string): Promise<string | null>;

    setSelectedChatBotId(guild: string, personalityId: string | null): Promise<void>;
}

// TODO : ne pas tout mettre dans un même repo
export class BotRepository implements IBotRepository {

    private readonly dataSource: DataSource;
    private readonly ready: Promise<DataSource>;

    constructor() {
        this.dataSource = new DataSource({
            type: 'sqlite',
            database: './database.sqlite',
            entities: [CustomCommand, ChatBotPersonality, GuildAiSettings],
            synchronize: false,
            logging: process.env.LOG_DB === 'true',
        });
        this.ready = this.initialize();
        this.ready.catch(error => console.error('Could not initialize the database', error));
    }

    private async initialize(): Promise<DataSource> {
        const dataSource = await this.dataSource.initialize();
        await this.migrateProviderColumn(dataSource);
        await dataSource.synchronize();
        return dataSource;
    }

    /**
     * The AI revamp renamed ChatBotPersonality.provider to model. TypeORM sees that as a drop plus
     * an add and would wipe the values, so they are copied across before it synchronizes.
     */
    private async migrateProviderColumn(dataSource: DataSource): Promise<void> {
        const columns: { name: string }[] = await dataSource.query('PRAGMA table_info(chat_bot_personality)');
        const columnNames = columns.map(column => column.name);
        if (!columnNames.includes('provider') || columnNames.includes('model')) {
            return;
        }
        await dataSource.query('ALTER TABLE chat_bot_personality ADD COLUMN model text');
        await dataSource.query('UPDATE chat_bot_personality SET model = trim(provider)');
        console.log('Migrated chat bot personalities from provider to model.');
    }

    private async repositoryOf<T extends ObjectLiteral>(entity: EntityTarget<T>): Promise<Repository<T>> {
        return (await this.ready).getRepository(entity);
    }

    async getChatBotPersonalities(): Promise<ChatBotPersonality[]> {
        return (await this.repositoryOf(ChatBotPersonality)).find();
    }

    async getChatBotPersonality(id: string): Promise<ChatBotPersonality | null> {
        return (await this.repositoryOf(ChatBotPersonality)).findOne({where: {id}});
    }

    async saveChatBotPersonality(id: string, model: string | null, systemPrompt: string): Promise<ChatBotPersonality> {
        return (await this.repositoryOf(ChatBotPersonality))
            .save(new ChatBotPersonality(id, model, systemPrompt));
    }

    async deleteChatBotPersonality(id: string): Promise<boolean> {
        const deleteResult = await (await this.repositoryOf(ChatBotPersonality)).delete({id});
        return deleteResult.affected === 1;
    }

    async getSelectedChatBotId(guild: string): Promise<string | null> {
        const settings = await (await this.repositoryOf(GuildAiSettings)).findOne({where: {guild}});
        return settings?.personalityId ?? null;
    }

    async setSelectedChatBotId(guild: string, personalityId: string | null): Promise<void> {
        await (await this.repositoryOf(GuildAiSettings)).save(new GuildAiSettings(guild, personalityId));
    }

    async getCustomCommand(guild: string, name: string): Promise<CustomCommand | null> {
        return (await this.repositoryOf(CustomCommand)).findOne({where: {guild, name}});
    }

    async getCustomCommands(guild: string): Promise<CustomCommand[]> {
        return (await this.repositoryOf(CustomCommand)).find({where: {guild}});
    }

    async createCustomCommand(guild: string, name: string, content: string): Promise<CustomCommand> {
        return (await this.repositoryOf(CustomCommand)).save(new CustomCommand(name, guild, content));
    }

    async deleteCustomCommand(guild: string, name: string): Promise<boolean> {
        const deleteResult = await (await this.repositoryOf(CustomCommand)).delete({guild, name});
        return deleteResult.affected === 1;
    }
}
