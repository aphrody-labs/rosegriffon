import { Rank } from "./User";
import { UserDTO } from "../../shared/services/user-service";
import { ClanMemberDistinction, ClanMemberDTO } from "./ClanMember";

export type Clan = {
	id: number;
	logo: string;
	name: string;
	shortName: string;
	description: string;
	captain: string;
	founders: string[];
	x_url?: string;
	instagram_url?: string;
	tiktok_url?: string;
	fame: number;
	xp: number;
	rank?: Rank;
	created_at: Date;
	isPro: boolean;
	isRecruiting: boolean;
	autoRecruit: boolean;
	langue?: string;
};

export type ClanDTO = {
	// Clan entity
	id: number;
	founders: string;
	name: string;
	shortenedName: string;
	normalizedShortName: string;
	clanAvatarUrl: string;
	clanBiography: string;
	fame: number;
	xUrl?: string | null;
	instagramUrl?: string | null;
	tiktokUrl?: string | null;
	isRecruiting: boolean;
	isInactive: boolean;
	isHidden: boolean;
	isDisbanded: boolean;
	autoAcceptMembers: boolean;
	state: ClanState;
	createdAt: Date;
	languages: string[];
	origin: string;

	// Extra data
	experience: { currentLevel: number; totalXp: number };
	membersCount: number;
	president: any;
};

export enum ClanState {
	Creating,
	PendingReview,
	Approved,
}

export interface ClanInviteDTO {
	id: number;
	user: UserDTO;
	clan: ClanDTO;
	inviter: ClanMemberDTO;
	threadId?: string;
	distinctions: ClanMemberDistinction[];
	createdAt: Date;
	updatedAt: Date;
	lastNotifiedAt: Date;
}

export type ClanApplicationDTO = {
	id: number;
	user: UserDTO;
	clan: ClanDTO;
	distinctions: ClanMemberDistinction[];
	createdAt: Date;
	updatedAt: Date;
};
