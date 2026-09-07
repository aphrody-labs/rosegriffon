import { UserDTO } from "../../shared/services/user-service";

import { SocialMediaDTO } from "./SocialMedia";
import { Country } from "../../shared/services/language-service";

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

export enum OrganizationState {
	Pending = 0,
	Approved = 1,
	Rejected = 2,
}

export enum OrganizationFormMode {
	Create,
	Validate,
	Edit,
}
