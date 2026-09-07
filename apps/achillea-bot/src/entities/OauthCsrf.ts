import { EntityRepository, EntityRepositoryType } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

import { CustomBaseEntity } from "./BaseEntity";

@Entity({ repository: () => OauthCsrfRepository })
export class OauthCsrf extends CustomBaseEntity {
	[EntityRepositoryType]?: OauthCsrfRepository;

	@PrimaryKey()
	token!: string;

	@Property()
	discordId!: string;
}

export class OauthCsrfRepository extends EntityRepository<OauthCsrf> {}
