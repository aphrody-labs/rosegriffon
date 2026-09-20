import type { OrganizationState } from "../enums/organization";

import type { Country, SocialMediaDTO } from "./common";
import type { UserDTO } from "./user";

export interface OrganizationDTO {
	id?: string;
	state?: OrganizationState;
	name: string;
	normalizedName: string;
	logo: string;
	description: string;
	owner: UserDTO;
	orgManagers: UserDTO[];
	managers?: OrgManagerDTO[];
	preapproved?: boolean;
	socialMedias: SocialMediaDTO[];
	broadcastMedias: SocialMediaDTO[];
	origin: Country;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface OrgManagerDTO {
	organization?: OrganizationDTO | number;
	user: UserDTO;
	createdAt?: Date;
	updatedAt?: Date;
}

/** Revue d'une demande de création / édition d'organisation. */
export interface OrganizationValidationDTO {
	id?: string;
	reviewer: UserDTO;
	name: string | null;
	logo: string | null;
	description: string | null;
	twitterUrl: string | null;
	instagramUrl: string | null;
	tiktokUrl: string | null;
	twitchUrl: string | null;
	youtubeUrl: string | null;
}
