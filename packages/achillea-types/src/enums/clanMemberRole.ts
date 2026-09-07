export enum ClanMemberRole {
	Trial,
	Member,
	SubCaptain,
	Captain,
}

export const ClanMemberRoleName: Record<ClanMemberRole, string> = {
	[ClanMemberRole.Trial]: "Membre à l'essai",
	[ClanMemberRole.Member]: "Membre",
	[ClanMemberRole.SubCaptain]: "Vice-Président",
	[ClanMemberRole.Captain]: "Président",
};

export enum ClanMemberDistinction {
	Player = "Joueur",
	Staff = "Staff",
	Artist = "Artiste",
	ContentCreator = "Créateur de contenu",
}
