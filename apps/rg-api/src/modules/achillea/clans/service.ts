import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import type { ClanDTO } from "./model";

export abstract class ClanService {
	public static async findAll(db: Kysely<Database>, page = 1, pageSize = 50): Promise<{ data: ClanDTO[]; count: number }> {
		const base = db
			.selectFrom("clan")
			.selectAll()
			.where("is_disbanded", "=", false);
		const [rows, countRow] = await Promise.all([
			base.orderBy("clan_fame", "desc").limit(pageSize).offset((page - 1) * pageSize).execute(),
			db.selectFrom("clan").select(({ fn }) => fn.countAll<number>().as("count")).where("is_disbanded", "=", false).executeTakeFirst(),
		]);

		const data: ClanDTO[] = rows.map((r) => ({
			id: r.id,
			name: r.name,
			shortName: r.shortened_name,
			avatarUrl: r.clan_avatar_url,
			biography: r.clan_biography,
			fame: r.clan_fame,
			isRecruiting: Boolean(r.is_recruiting),
			membersLimit: Boolean(r.under_member_limit)
		}));

		return { data, count: Number(countRow?.count ?? data.length) };
	}

	public static async findById(db: Kysely<Database>, id: number): Promise<ClanDTO | null> {
		const r = await db
			.selectFrom("clan")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		if (!r) return null;

		return {
			id: r.id,
			name: r.name,
			shortName: r.shortened_name,
			avatarUrl: r.clan_avatar_url,
			biography: r.clan_biography,
			fame: r.clan_fame,
			isRecruiting: Boolean(r.is_recruiting),
			membersLimit: Boolean(r.under_member_limit)
		};
	}
}
