import { Data, DataRepository, defaultData } from "@/entities/Data";
import { ClanMemberDistinction } from "@/utils/enums";

export type ClanMemberLimits = {
	playerLimit: number;
	staffLimit: number;
};

export const CLAN_MEMBER_LIMIT_BOUNDS = {
	player: { min: 1, max: 100 },
	staff: { min: 1, max: 50 },
} as const;

export function normalizeClanMemberLimits(input: {
	playerLimit?: unknown;
	staffLimit?: unknown;
}): ClanMemberLimits {
	const bound = (value: unknown, fallback: number, min: number, max: number) => {
		const n = typeof value === "number" ? value : Number(value);
		if (!Number.isFinite(n)) return fallback;
		return Math.round(Math.max(min, Math.min(max, n)));
	};

	return {
		playerLimit: bound(
			input.playerLimit,
			defaultData.clanPlayerLimit,
			CLAN_MEMBER_LIMIT_BOUNDS.player.min,
			CLAN_MEMBER_LIMIT_BOUNDS.player.max
		),
		staffLimit: bound(
			input.staffLimit,
			defaultData.clanStaffLimit,
			CLAN_MEMBER_LIMIT_BOUNDS.staff.min,
			CLAN_MEMBER_LIMIT_BOUNDS.staff.max
		),
	};
}

export function checkClanMemberLimitExceeded(
	counts: { players: number; staff: number },
	limits: ClanMemberLimits,
	desiredDistinctions: ClanMemberDistinction[]
): "player" | "staff" | null {
	if (
		!desiredDistinctions.includes(ClanMemberDistinction.Player) &&
		!desiredDistinctions.includes(ClanMemberDistinction.Staff)
	) {
		return null;
	}

	if (
		desiredDistinctions.includes(ClanMemberDistinction.Player) &&
		counts.players >= limits.playerLimit
	) {
		return "player";
	}

	if (
		desiredDistinctions.includes(ClanMemberDistinction.Staff) &&
		counts.staff >= limits.staffLimit
	) {
		return "staff";
	}

	return null;
}

async function readDataKey<T extends keyof typeof defaultData>(
	repo: DataRepository,
	key: T
): Promise<(typeof defaultData)[T]> {
	const row = await repo.findOne({ key });
	if (!row) {
		const value = defaultData[key];
		await repo.add(key, value);
		return value;
	}

	return JSON.parse(row.value) as (typeof defaultData)[T];
}

export async function getClanMemberLimits(em: DatabaseEntityManager): Promise<ClanMemberLimits> {
	const repo = em.getRepository(Data) as DataRepository;
	const [playerLimit, staffLimit] = await Promise.all([
		readDataKey(repo, "clanPlayerLimit"),
		readDataKey(repo, "clanStaffLimit"),
	]);

	return normalizeClanMemberLimits({ playerLimit, staffLimit });
}

export async function setClanMemberLimits(
	em: DatabaseEntityManager,
	limits: ClanMemberLimits
): Promise<ClanMemberLimits> {
	const normalized = normalizeClanMemberLimits(limits);
	const repo = em.getRepository(Data) as DataRepository;
	await repo.set("clanPlayerLimit", normalized.playerLimit);
	await repo.set("clanStaffLimit", normalized.staffLimit);
	return normalized;
}
