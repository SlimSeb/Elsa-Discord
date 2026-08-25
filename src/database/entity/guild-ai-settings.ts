import {Column, Entity, PrimaryColumn} from 'typeorm';

/** Which chat bot personality a guild is currently talking to. */
@Entity()
export class GuildAiSettings {
    constructor(guild: string, personalityId: string | null) {
        this.guild = guild;
        this.personalityId = personalityId;
    }

    @PrimaryColumn({type: 'text'}) guild!: string;
    @Column({type: 'text', nullable: true}) personalityId!: string | null;
}
