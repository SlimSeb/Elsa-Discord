import {Column, Entity, PrimaryColumn} from 'typeorm';

/** A named bot persona: a system prompt plus the model that should answer with it. */
@Entity()
export class ChatBotPersonality {
    constructor(id: string, model: string | null, systemPrompt: string) {
        this.id = id;
        this.model = model;
        this.systemPrompt = systemPrompt;
    }

    @PrimaryColumn({type: 'text'}) id!: string;
    @Column({type: 'text'}) systemPrompt!: string;
    /** Null falls back to the default model, so personalities survive a model being retired. */
    @Column({type: 'text', nullable: true}) model!: string | null;
}
