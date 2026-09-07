import { ClanMemberDistinction, ClanMemberRole } from "@achillea/types";
import { UserDTO } from "../../shared/services/user-service";

// Enums : source unique @achillea/types (partagés avec le bot).
export { ClanMemberDistinction, ClanMemberRole } from "@achillea/types";

export type ClanMemberDTO = {
	/** Role of the member in the clan (e.g., Captain, SubCaptain, Member) */
	clanRole: ClanMemberRole;

	/** List of distinctions, e.g. ['Staff', 'Player'] */
	distinctions: string[];

	/** Total fame contributed by this member */
	clanFameContributed: number;

	/** Date when they joined the clan */
	createdAt: Date;

	/** Last update time of the record */
	updatedAt: Date;

	/** Enriched user data (rank, xp, Twitch, etc.) */
	user: UserDTO;
};

export const ClanMemberRoleName: Record<ClanMemberRole, string> = {
	[ClanMemberRole.Trial]: "Membre à l'essai",
	[ClanMemberRole.Member]: "Membre",
	[ClanMemberRole.SubCaptain]: "Vice-Président",
	[ClanMemberRole.Captain]: "Président",
};

export const ClanMemberDistinctionName: Record<ClanMemberDistinction, string> = {
	[ClanMemberDistinction.Player]: "Joueur",
	[ClanMemberDistinction.Staff]: "Staff",
	[ClanMemberDistinction.Artist]: "Artiste",
	[ClanMemberDistinction.ContentCreator]: "Créateur de contenu",
};

export const distinctionPriority: Record<string, number> = {
	Staff: 1,
	Player: 2,
	Artist: 3,
	ContentCreator: 4,
};
