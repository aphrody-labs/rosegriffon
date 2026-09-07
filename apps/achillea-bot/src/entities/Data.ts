import { EntityRepository, EntityRepositoryType } from "@mikro-orm/core";
import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

import { CustomBaseEntity } from "./BaseEntity";

/**
 * Default data for the Data table (dynamic EAV key/value pattern)
 */
export const defaultData = {
	maintenance: false,
	lastMaintenance: Date.now(),
	lastStartup: Date.now(),
	rankedEnabled: false,
	// ID du message persistant du classement Ranked (salon leaderboard) — édité en place.
	leaderboardMessageId: "",
	// ID du panneau persistant du salon ranked-queue (CTA + stats + derniers résultats).
	rankedQueueMessageId: "",
	// Snapshot du palier (index) par joueur, pour détecter les promotions entre deux passes.
	rankedTierSnapshot: {} as Record<string, number>,
	// Limites d'effectif par clan (pilotables depuis le dashboard admin).
	clanPlayerLimit: 30,
	clanStaffLimit: 7,
	// Google Doc du registre des signalements joueurs (dossier Drive Achillea).
	// Vide tant qu'aucun signalement n'a été déposé : le document est créé au premier.
	playerNotesDocId: "",
};

type DataType = keyof typeof defaultData;

// ===========================================
// ================= Entity ==================
// ===========================================

@Entity({ repository: () => DataRepository })
export class Data extends CustomBaseEntity {
	[EntityRepositoryType]?: DataRepository;

	@PrimaryKey()
	key!: string;

	@Property()
	value: string = "";
}

// ===========================================
// =========== Custom Repository =============
// ===========================================

export class DataRepository extends EntityRepository<Data> {
	async get<T extends DataType>(key: T): Promise<(typeof defaultData)[T]> {
		const data = await this.findOne({ key });

		return JSON.parse(data!.value);
	}

	async set<T extends DataType>(key: T, value: (typeof defaultData)[T]): Promise<void> {
		const data = await this.findOne({ key });

		if (!data) {
			const newData = new Data();
			newData.key = key;
			newData.value = JSON.stringify(value);

			await this.em.persist(newData).flush();
		} else {
			data.value = JSON.stringify(value);
			await this.em.flush();
		}
	}

	async add<T extends DataType>(key: T, value: (typeof defaultData)[T]): Promise<void> {
		const data = await this.findOne({ key });

		if (!data) {
			const newData = new Data();
			newData.key = key;
			newData.value = JSON.stringify(value);

			await this.em.persist(newData).flush();
		}
	}
}
