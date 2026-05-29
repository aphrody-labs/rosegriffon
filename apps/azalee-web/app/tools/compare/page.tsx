import type { Metadata } from "next";
import { CharacterComparator } from "@/components/wiki/CharacterComparator";
import type { CompareCharacter, SkillInfo } from "@/components/wiki/CharacterComparator";
import { createClient } from "@/lib/supabase/server";
import { wikiService } from "@/lib/wiki-service";

export const dynamic = "force-dynamic";

// Phantom skill IDs that exist in game data but have no corresponding DB entry
// 0xDBEDB6B8 = aura-dependent special technique slot (empty placeholder)
const PHANTOM_SKILL_IDS = new Set(["0xDBEDB6B8"]);

function mapSkill(skill: any) {
	return {
		category: skill.categoryName?.fr || "Spécial",
		element: skill.elementName?.en?.toLowerCase(),
		id: skill.skillId || skill.skillID || skill.skillIDStr || "",
		isPassive:
			skill.categoryName?.en?.toLowerCase() === "passive" ||
			skill.categoryName?.fr?.toLowerCase() === "talent" ||
			skill.skillType === "passive",
		name: skill.displayName || skill.name_FR || skill.name_EN || "???",
		power: skill.power_min ? `${skill.power_min}` : undefined,
		tension: skill.tp ?? skill.tension ?? undefined,
	};
}

/** Resolve skill names from a newline/comma-separated string (sheetData moveset/firstMoves) */
async function resolveSkillNames(raw: string): Promise<SkillInfo[]> {
	const separator = raw.includes("\n") ? "\n" : ",";
	const moveNames = raw
		.split(separator)
		.map((s) => s.trim())
		.filter((s) => s && !s.startsWith("#N/A") && !s.startsWith("Mix "));
	const resolved = await Promise.all(moveNames.map((name) => wikiService.getSkill(name)));
	const seen = new Set<string>();
	return resolved
		.filter(Boolean)
		.map((skill: any) => mapSkill(skill))
		.filter((s) => {
			if (seen.has(s.name)) {
				return false;
			}
			seen.add(s.name);
			return true;
		});
}

/** Try to inherit skills from a sibling variant (same chara_id) that has skill data */
async function inheritSkillsFromSibling(charaId: string, currentId: string): Promise<SkillInfo[]> {
	const supabase = await createClient();
	const { data: siblings } = await supabase
		.from("inagle_characters")
		.select("skills, sheet_data")
		.eq("chara_id", charaId)
		.neq("id", currentId)
		.limit(5);

	if (!siblings) {
		return [];
	}

	for (const sib of siblings) {
		const sd = (sib.sheet_data as any) || {};

		// Try sheetData moves first (more reliable names)
		const moveSource = sd.firstMoves || sd.moveset;
		if (moveSource) {
			const resolved = await resolveSkillNames(moveSource);
			if (resolved.length > 0) {
				return resolved;
			}
		}

		// Try binary skills
		const rawSkills: any[] = Array.isArray(sib.skills) ? sib.skills : [];
		if (rawSkills.length > 0) {
			const skillList = rawSkills
				.map((s: any) => (typeof s === "string" ? { learnLevel: 0, skillId: s } : s))
				.filter((s: any) => !PHANTOM_SKILL_IDS.has(s.skillId));

			const fetched = await Promise.all(skillList.map((s: any) => wikiService.getSkill(s.skillId)));
			const resolved = fetched.filter(Boolean).map((skill: any) => mapSkill(skill));
			if (resolved.length > 0) {
				return resolved;
			}
		}
	}

	return [];
}

async function resolveCharacter(idOrSlug: string | undefined): Promise<CompareCharacter | null> {
	if (!idOrSlug) {
		return null;
	}

	let baseChar = await wikiService.getCharacter(idOrSlug);
	if (!baseChar) {
		baseChar = await wikiService.getCharacterBySlug(idOrSlug);
	}
	if (!baseChar) {
		return null;
	}

	const variant = (baseChar.variants as any[])?.[0];
	if (!variant) {
		return null;
	}

	const stats = variant.stats?.lv99 || {};
	const sd = variant.sheetData || (baseChar as any).sheetData || {};
	const isBasara = variant.rarity === "BASARA" || (variant.rarityCode ?? 0) >= 20;

	// Resolve skills — multiple fallback strategies
	let skills: SkillInfo[] = [];

	if (isBasara && sd.moveset) {
		// BASARA: use dedicated sheet moveset
		skills = await resolveSkillNames(sd.moveset);
	} else {
		// 1) Try binary skill IDs (filter out phantom slots)
		const rawSkills: Array<{ learnLevel: number; skillId: string }> | string[] =
			variant.skills || [];
		const skillList = rawSkills
			.map((s: any) => (typeof s === "string" ? { learnLevel: 0, skillId: s } : s))
			.filter((s: any) => !PHANTOM_SKILL_IDS.has(s.skillId));

		if (skillList.length > 0) {
			const fetchedSkills = await Promise.all(
				skillList.map((s: any) => wikiService.getSkill(s.skillId))
			);
			skills = fetchedSkills.filter(Boolean).map((skill: any) => mapSkill(skill));
		}

		// 2) Fallback: use firstMoves/moveset from sheetData (skill names)
		if (skills.length === 0) {
			const moveSource = sd.firstMoves || sd.moveset;
			if (moveSource) {
				skills = await resolveSkillNames(moveSource);
			}
		}

		// 3) Fallback: inherit from a sibling variant with the same chara_id
		if (skills.length === 0) {
			const charaId = (baseChar as any).charaId || (baseChar as any).internalCode;
			if (charaId) {
				skills = await inheritSkillsFromSibling(charaId, variant.charaParamId || idOrSlug);
			}
		}
	}

	// Deduplicate skills by name (keep first occurrence)
	const seen = new Set<string>();
	skills = skills.filter((s) => {
		if (seen.has(s.name)) {
			return false;
		}
		seen.add(s.name);
		return true;
	});

	return {
		element: variant.element || "Void",
		image: baseChar.image || variant.image || null,
		internalCode: (baseChar as any).internalCode || (baseChar as any).charaId || undefined,
		name: baseChar.names.fr || baseChar.names.en || "Inconnu",
		nameEn: baseChar.names.en || undefined,
		nameJa: baseChar.names.ja || undefined,
		position: variant.position || "MF",
		rarity: variant.rarity || "Normal",
		skills,
		slug: (baseChar as any).slug || idOrSlug,
		stats: {
			agility: stats.agility || 0,
			control: stats.control || 0,
			intelligence: stats.intelligence || 0,
			kick: stats.kick || 0,
			physical: stats.physical || 0,
			pressure: stats.pressure || 0,
			technique: stats.technique || 0,
		},
		teamName: (baseChar as any).teamName || undefined,
		zukanHash: baseChar.zukanHash || variant.zukanHash || undefined,
	};
}

export async function generateMetadata({
	searchParams,
}: {
	searchParams: Promise<{ char1?: string; char2?: string }>;
}): Promise<Metadata> {
	const { char1, char2 } = await searchParams;

	if (!char1 && !char2) {
		return {
			alternates: { canonical: "/tools/compare" },
			description:
				"Comparez deux personnages d'Inazuma Eleven: Victory Road côte à côte. Stats, techniques et bien plus.",
			title: "Comparateur de personnages | Azalée",
		};
	}

	const [c1, c2] = await Promise.all([resolveCharacter(char1), resolveCharacter(char2)]);

	const names = [c1?.name, c2?.name].filter(Boolean).join(" vs ");

	return {
		description: `Comparaison ${names} dans Inazuma Eleven: Victory Road. Stats, techniques, éléments et positions.`,
		title: `${names || "Comparateur"} | Azalée`,
	};
}

export default async function ComparePage({
	searchParams,
}: {
	searchParams: Promise<{ char1?: string; char2?: string }>;
}) {
	const { char1, char2 } = await searchParams;
	const [character1, character2] = await Promise.all([
		resolveCharacter(char1),
		resolveCharacter(char2),
	]);

	return (
		<div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
			<CharacterComparator char1={character1} char2={character2} />
		</div>
	);
}
