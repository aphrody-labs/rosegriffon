/**
 * `/organizations` — structures e-sport, leur revue et leurs managers.
 */

import { z } from "zod";

import type { Paginated } from "@rosegriffon/achillea-types/domain/common";
import type {
	OrganizationDTO,
	OrganizationValidationDTO,
	OrgManagerDTO,
} from "@rosegriffon/achillea-types/domain/organization";
import { OrganizationState } from "@rosegriffon/achillea-types/enums/organization";

import {
	apiDateSchema,
	apiEnvelopeSchema,
	countrySchema,
	paginatedSchema,
	socialMediaDtoSchema,
	userDtoSchema,
} from "./common";
import {
	AchilleaResource,
	encodePathSegment,
	type AchilleaClientResult,
} from "./http";
import type { ApiEnvelope } from "./pending-contracts";

export const organizationStateSchema = z.enum(
	OrganizationState
) satisfies z.ZodType<OrganizationState>;

/**
 * `OrganizationDTO` et `OrgManagerDTO` se référencent mutuellement : le schéma
 * est donc paresseux des deux côtés, avec un type explicite pour couper le
 * cycle d'inférence.
 */
export const organizationDtoSchema: z.ZodType<OrganizationDTO> = z.object({
	id: z.string().optional(),
	state: organizationStateSchema.optional(),
	name: z.string(),
	normalizedName: z.string(),
	logo: z.string(),
	description: z.string(),
	owner: userDtoSchema,
	orgManagers: z.array(userDtoSchema),
	managers: z.array(z.lazy(() => orgManagerDtoSchema)).optional(),
	preapproved: z.boolean().optional(),
	socialMedias: z.array(socialMediaDtoSchema),
	broadcastMedias: z.array(socialMediaDtoSchema),
	origin: countrySchema,
	createdAt: apiDateSchema.optional(),
	updatedAt: apiDateSchema.optional(),
});

export const orgManagerDtoSchema: z.ZodType<OrgManagerDTO> = z.object({
	organization: z.union([z.number(), z.lazy(() => organizationDtoSchema)]).optional(),
	user: userDtoSchema,
	createdAt: apiDateSchema.optional(),
	updatedAt: apiDateSchema.optional(),
});

export const organizationValidationDtoSchema = z.object({
	id: z.string().optional(),
	reviewer: userDtoSchema,
	name: z.string().nullable(),
	logo: z.string().nullable(),
	description: z.string().nullable(),
	twitterUrl: z.string().nullable(),
	instagramUrl: z.string().nullable(),
	tiktokUrl: z.string().nullable(),
	twitchUrl: z.string().nullable(),
	youtubeUrl: z.string().nullable(),
}) satisfies z.ZodType<OrganizationValidationDTO>;

const organizationEnvelopeSchema = apiEnvelopeSchema(organizationDtoSchema);
const organizationListEnvelopeSchema = apiEnvelopeSchema(z.array(organizationDtoSchema));
const orgManagerListEnvelopeSchema = apiEnvelopeSchema(z.array(orgManagerDtoSchema));
const opaqueEnvelopeSchema = apiEnvelopeSchema(z.unknown());

export type OrganizationListQuery = {
	page?: number;
	/** Taille de page — le contrôleur l'attend sous le nom `pagination`. */
	pagination?: number;
	state?: OrganizationState;
}

/** 7 routes. */
export class OrganizationsResource extends AchilleaResource {
	/** `GET /organizations` — annuaire paginé, filtré par état de revue. */
	list(
		query: OrganizationListQuery = {}
	): Promise<AchilleaClientResult<Paginated<OrganizationDTO>>> {
		return this.http.get("/organizations", paginatedSchema(organizationDtoSchema), {
			query,
		});
	}

	/** `GET /organizations/:id` — fiche d'une organisation. */
	get(id: number | string): Promise<AchilleaClientResult<ApiEnvelope<OrganizationDTO>>> {
		return this.http.get(`/organizations/${encodePathSegment(id)}`, organizationEnvelopeSchema);
	}

	/**
	 * `GET /organizations/me` — organisations du compte connecté.
	 *
	 * Longtemps inatteignable : le contrôleur la déclarait après `/:id`, qui
	 * capturait « me » comme identifiant. Corrigé côté API en remontant la
	 * route littérale avant le joker.
	 */
	mine(): Promise<AchilleaClientResult<ApiEnvelope<OrganizationDTO[]>>> {
		return this.http.get("/organizations/me", organizationListEnvelopeSchema);
	}

	/** `POST /organizations/create` — dépose une demande de création. */
	create(payload: OrganizationDTO): Promise<AchilleaClientResult<ApiEnvelope<OrgManagerDTO[]>>> {
		return this.http.post("/organizations/create", orgManagerListEnvelopeSchema, payload);
	}

	/** `POST /organizations/validate` — même traitement, chemin de revue historique. */
	validate(
		payload: OrganizationDTO
	): Promise<AchilleaClientResult<ApiEnvelope<OrgManagerDTO[]>>> {
		return this.http.post("/organizations/validate", orgManagerListEnvelopeSchema, payload);
	}

	/** `POST /organizations/:id/approve` — approuve une organisation en attente. */
	approve(id: number | string): Promise<AchilleaClientResult<ApiEnvelope<unknown>>> {
		return this.http.post(
			`/organizations/${encodePathSegment(id)}/approve`,
			opaqueEnvelopeSchema
		);
	}

	/** `POST /organizations/:id/reject` — rejette une organisation en attente. */
	reject(id: number | string): Promise<AchilleaClientResult<ApiEnvelope<unknown>>> {
		return this.http.post(
			`/organizations/${encodePathSegment(id)}/reject`,
			opaqueEnvelopeSchema
		);
	}
}
