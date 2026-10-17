export interface EventEntity {
	id: number;
	name: string;
	description: string;
	type: EventTypeEnum;
	createdAt: Date;
	updatedAt: Date;
}

export enum EventTypeEnum {
	TOURNAMENT = "TOURNAMENT",
	INTERCLAN = "INTERCLAN",
	RANKED = "RANKED",
}
