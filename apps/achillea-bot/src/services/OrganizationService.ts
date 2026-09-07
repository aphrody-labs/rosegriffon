import { rel, wrap } from "@mikro-orm/core";
import { BadRequest, NotFound } from "@tsed/exceptions";
import { plainToInstance } from "class-transformer";
import { Client } from "@aphrody/discordx";
import GraphemeSplitter from "grapheme-splitter";

import { Service } from "@/decorators";
import { Organization, User } from "@/entities";
import type { SocialMediaDTO } from "@/utils/functions";
import {
	isSocialMediaUrl,
	normalizeNames,
	resolveDependency,
	SocialMedia,
} from "@/utils/functions";

import type { NewOrganizationDTO } from "../api/models/dtos/organizationDTO";
import { OrganizationDTO } from "../api/models/dtos/organizationDTO";
import { OrganizationManager } from "../entities/OrganizationManager";
import { OrganizationCreationErrors } from "../utils/enums/organizationErrors";
import { OrganizationState } from "../utils/enums/organizationState";
import { logOnSuperAdminChannel } from "../utils/functions/messager";
import type { Country } from "../utils/types/country";
import { COUNTRIES } from "../utils/types/country";
import { Database } from "./Database";
import { Logger } from "./Logger";
import type { UserDTO } from "./UserService";
import { UserService } from "./UserService";

@Service()
export class OrganizationService {
	constructor(
		private db: Database,
		private client: Client
	) {}

	async getSingleOrganization(orgId: number) {
		const org = await this.db.em.findOne(Organization, { id: orgId });

		if (!org) throw new NotFound("Organization not found");

		return await this.toDTO(org);
	}

	/** Change l'état d'une organisation (validation admin : Approved / Rejected). */
	async setOrganizationState(orgId: number, state: OrganizationState): Promise<OrganizationDTO> {
		const em = this.db.em.fork();
		const org = await em.findOne(Organization, { id: orgId });
		if (!org) throw new NotFound("Organization not found");

		org.state = state;
		await em.flush();

		return await this.getSingleOrganization(orgId);
	}

	async getOrganizations(
		page: number,
		pageSize: number,
		state: OrganizationState = OrganizationState.Approved
	): Promise<[OrganizationDTO[], number]> {
		const [clans, total] = await this.db.em
			.getRepository(Organization)
			.getAllOrganizations(page, pageSize, state);

		const dtos = await Promise.all(clans.map(async (organization) => this.toDTO(organization)));

		return [dtos, total];
	}

	async getUserOrganizations(user: UserDTO) {
		const ownedOrgs = await this.db.em.find(Organization, { owner: user.id });
		const memberOf = await this.db.em.find(
			OrganizationManager,
			{ user: user.id },
			{ populate: ["organization"] }
		);
		const managedOrgs = memberOf.map((member) => member.organization);

		return ownedOrgs.concat(managedOrgs);
	}

	async toDTO(organization: Organization): Promise<OrganizationDTO> {
		const plainObject = wrap(organization).toObject();
		const dto = plainToInstance(OrganizationDTO, plainObject, { excludeExtraneousValues: true });
		const userService = new UserService(this.db, this.client);
		const owner = await userService.getUserDTO(organization.owner.id);
		if (!owner) {
			throw new NotFound(`Owner not found for organization ${organization.id}`);
		}
		// Assign orgManagers
		dto.owner = owner;
		dto.socialMedias = this.toSocialMedias(organization);
		dto.broadcastMedias = this.toBroadcastMedias(organization);
		dto.orgManagers = await this.getOrgManagersAsUsersDTO(organization, userService);

		return dto;
	}

	toSocialMedias(organization: Organization): SocialMediaDTO[] {
		const socials: SocialMediaDTO[] = [];
		if (organization.twitterUrl)
			socials.push({
				platform: SocialMedia.X,
				canonicalUrl: organization.twitterUrl,
				username: this.getSocialsUsername(organization.twitterUrl),
			});
		if (organization.instagramUrl)
			socials.push({
				platform: SocialMedia.Instagram,
				canonicalUrl: organization.instagramUrl,
				username: this.getSocialsUsername(organization.instagramUrl),
			});
		if (organization.tiktokUrl)
			socials.push({
				platform: SocialMedia.TikTok,
				canonicalUrl: organization.tiktokUrl,
				username: this.getSocialsUsername(organization.tiktokUrl),
			});

		return socials;
	}

	toBroadcastMedias(organization: Organization): SocialMediaDTO[] {
		const socials: SocialMediaDTO[] = [];
		if (organization.twitchUrl)
			socials.push({
				platform: SocialMedia.Twitch,
				canonicalUrl: organization.twitchUrl,
				username: this.getSocialsUsername(organization.twitchUrl),
			});
		if (organization.youtubeUrl)
			socials.push({
				platform: SocialMedia.Youtube,
				canonicalUrl: organization.youtubeUrl,
				username: this.getSocialsUsername(organization.youtubeUrl),
			});

		return socials;
	}

	getSocialsUsername(urlString: string) {
		const url = new URL(urlString);

		return url.pathname.split("/").find(Boolean) ?? "";
	}

	async getOrgManagersAsUsersDTO(organization: Organization, userService: UserService) {
		const managers = await this.db.em.find(OrganizationManager, { organization });

		return Promise.all(managers.map(async (manager) => userService.getUserDTO(manager.user.id)));
	}

	async validateOrgManagers(orgManagers: UserDTO[]) {
		const orgManagersIds = orgManagers.map((orgManager) => orgManager.id);
		if (new Set(orgManagersIds).size !== orgManagersIds.length)
			throw new BadRequest(OrganizationCreationErrors.DUPLICATED_MANAGERS);
	}

	async validateName(name: string, originalNormalizedName: string) {
		const splitter = new GraphemeSplitter();
		const count = splitter.countGraphemes(name);
		const normalizedName = normalizeNames(name);
		if (count < 3 || count > 30 || !normalizedName)
			throw new BadRequest(OrganizationCreationErrors.INVALID_NAME);
		if (originalNormalizedName.toLowerCase().trim() !== normalizedName.toLowerCase().trim())
			throw new BadRequest(OrganizationCreationErrors.NORMALIZED_NO_MATCH);
		const orgExists = await this.db.em.findOne(Organization, { normalizedName });
		if (orgExists) throw new BadRequest(OrganizationCreationErrors.NAME_TAKEN);
	}

	async validateSocials(socialUrls: SocialMediaDTO[], type: "social" | "broadcast") {
		const socials = await Promise.all(
			socialUrls.map(async (media) => await isSocialMediaUrl(media.canonicalUrl))
		);

		const filteredSocials = socials.filter((social) => social !== null);
		if (filteredSocials.length !== socialUrls.length)
			throw new BadRequest(
				type === "social"
					? OrganizationCreationErrors.INVALID_SOCIALS
					: OrganizationCreationErrors.INVALID_BROADCASTS
			);
	}

	validateOrigin(origin: Country) {
		if (!COUNTRIES.find((country) => country.code === origin.code))
			throw new BadRequest(OrganizationCreationErrors.INVALID_ORIGIN);
	}

	async createOrganization(dto: NewOrganizationDTO) {
		try {
			const newOrg = new Organization();
			newOrg.name = dto.name;
			newOrg.normalizedName = dto.normalizedName;
			newOrg.owner = rel(User, dto.owner.id);
			newOrg.logo = dto.logo;
			newOrg.origin = dto.origin.code;
			newOrg.description = dto.description;
			for (const social of [...dto.socialMedias, ...dto.broadcastMedias]) {
				switch (social.platform) {
					case SocialMedia.X:
						newOrg.twitterUrl = social.canonicalUrl;
						break;

					case SocialMedia.Instagram:
						newOrg.instagramUrl = social.canonicalUrl;
						break;

					case SocialMedia.TikTok:
						newOrg.tiktokUrl = social.canonicalUrl;
						break;

					case SocialMedia.Twitch:
						newOrg.twitchUrl = social.canonicalUrl;
						break;

					case SocialMedia.Youtube:
						newOrg.youtubeUrl = social.canonicalUrl;
						break;
				}
			}

			await this.db.em.persist(newOrg).flush();

			return newOrg;
		} catch (err: any) {
			console.error("Erreur interne lors de la création d'une organisation: ", err);

			throw new BadRequest("Impossible de créer cette organisation.");
		}
	}

	async addOrgManagers(users: UserDTO[], organizationId: number) {
		const addResults = await Promise.all(
			users.map(async (user) => {
				try {
					const newOrgManager = new OrganizationManager();
					newOrgManager.user = rel(User, user.id);
					newOrgManager.organization = rel(Organization, organizationId);

					this.db.em.persist(newOrgManager);

					return true;
				} catch {
					return false;
				}
			})
		);

		await this.db.em.flush();

		return addResults;
	}

	async logNewOrgSubmission(org: Organization) {
		const logger = await resolveDependency(Logger);

		await logOnSuperAdminChannel(logger, {
			content: `@everyone Une nouvelle organisation ${org.name} est en attente de validation sur le site !`,
		});
	}
}
