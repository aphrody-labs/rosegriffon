export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { OverrideSkillData } from "@/components/wiki/OverrideSkillSection";
import { SkillCutinSection } from "@/components/wiki/SkillCutinSection";
import { SkillDetail } from "@/components/wiki/SkillDetail";
import type { SkillVideoVariant } from "@/components/wiki/SkillVideoPlayer";
import { cutinHasAssets, getSkillCutin } from "@rosegriffon/azalee/game/skills-cutin";
import { createClient } from "@/lib/supabase/server";
import { wikiService } from "@/lib/wiki-service";

/**
 * getSkill() (lib/wiki-service.ts) spreads sheet_data — empty {} for the 993 real
 * skills — then overrides with a subset of DB columns. Several populated columns
 * (evolution_type, growth_type, tp_cost, foul_rate, partner_count, recast_time,
 * description_en, skill_effect_bit_flag) are never mapped, so the detail page can't
 * render them. We read them directly here and map onto the field names SkillDetail
 * already expects, without touching wiki-service.
 */
async function enrichSkillFromDbColumns(skill: Record<string, unknown>): Promise<void> {
	const code = skill.internalCode as string | undefined;
	if (!code) {
		return;
	}
	try {
		const supabase = await createClient();
		const { data } = await supabase
			.from("inagle_skills")
			.select(
				"evolution_type, growth_type, tp_cost, tension_cost, foul_rate, partner_count, recast_time, description_en, skill_effect_bit_flag, hash_id"
			)
			.eq("internal_code", code)
			.limit(1)
			.maybeSingle();
		if (!data) {
			return;
		}
		const row = data as Record<string, unknown>;
		// Tension: real skills carry tp_cost; tension_cost is null. Keep existing if set.
		if (skill.consumeTp == null) {
			skill.consumeTp = row.tp_cost ?? row.tension_cost ?? skill.consumeTp;
		}
		if (skill.foulRate == null && row.foul_rate != null) {
			skill.foulRate = row.foul_rate;
		}
		if (skill.partnerCount == null && row.partner_count != null) {
			skill.partnerCount = row.partner_count;
		}
		if (skill.recastTime == null && row.recast_time != null) {
			skill.recastTime = row.recast_time;
		}
		if (!skill.desc_EN && row.description_en) {
			skill.desc_EN = row.description_en;
		}
		// Fields newly surfaced (rendered by SkillDetail's stats grid).
		skill.evolutionType = row.evolution_type ?? null;
		skill.growthTypeId = row.growth_type ?? null;
		skill.skillEffectBitFlag = row.skill_effect_bit_flag ?? null;
		skill.hashId = row.hash_id ?? null;
	} catch {
		// Mirror/Postgres unavailable — fall back to whatever getSkill returned.
	}
}

/**
 * Variantes vidéo officielles de la technique (`inagle_skill_videos`).
 *
 * 236 techniques sur les 895 publiées par zukan ont DEUX vidéos (réussite/échec,
 * défense/contre-tir) : `inagle_skills.video_url` ne peut en porter qu'une, la
 * table de liaison porte les autres. Lecture sur la même source que le reste de
 * la fiche (miroir SQLite en prod, Postgres sinon).
 */
async function fetchSkillVideos(skillId: string): Promise<SkillVideoVariant[]> {
	try {
		const supabase = await createClient();
		const { data } = await supabase
			.from("inagle_skill_videos")
			.select("position, label, video_url, poster_url")
			.eq("skill_id", skillId)
			.order("position", { ascending: true });
		return (data ?? []).map((row) => ({
			label: row.label,
			posterUrl: row.poster_url,
			position: row.position,
			videoUrl: row.video_url,
		}));
	} catch {
		// Miroir/Postgres indisponible — la fiche retombe sur `skill.videoUrl`.
		return [];
	}
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const skill = await wikiService.getSkill(id);
	const name = skill?.name_FR || skill?.displayName || "Technique";
	const category = skill?.categoryName?.fr || skill?.categoryName?.en || "";
	const element = skill?.elementName?.fr || "";
	const power = skill?.power_min ? `Puissance ${skill.power_min}` : "";
	const tp = skill?.consumeTp ? `${skill.consumeTp} TP` : "";
	const metaParts = [name, category, element, power, tp].filter(Boolean);
	const description = `${metaParts.join(" - ")}. Technique spéciale Inazuma Eleven: Victory Road.`;
	const title = `${name} | Inazuma Eleven Victory Road - Azalée`;

	return {
		alternates: { canonical: `/skill/${id}` },
		description,
		openGraph: {
			description,
			images: skill?.image ? [{ url: skill.image, alt: name }] : [],
			locale: "fr_FR",
			siteName: "Azalée - Inazuma Eleven Victory Road",
			title: `${name} | Azalée`,
			type: "article",
			url: `/skill/${id}`,
		},
		title,
		twitter: {
			card: "summary",
			description,
			title: `${name} | Azalée`,
		},
	};
}

export default async function MoveDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;

	const skill = await wikiService.getSkill(id);
	if (!skill) {
		notFound();
	}

	// Rich DB columns not surfaced by getSkill() (wiki-service spreads an empty
	// sheet_data for real skills, so foulRate/growth/tp_cost/etc. never reach the UI).
	// Supplementary read on the same source (inagle_skills mirror) to enrich display.
	await enrichSkillFromDbColumns(skill as unknown as Record<string, unknown>);

	const name = skill.name_FR || skill.name_EN || skill.displayName || "Unknown";
	const desc = skill.desc_FR || skill.desc_EN || "";
	const category = skill.categoryName?.fr || skill.categoryName?.en || "Spécial";
	const element = skill.elementName?.fr || skill.elementName?.en || "Néant";

	// Fetch related skills from same category via wikiService (consistent types)
	const categoryKey = skill.categoryName?.en?.toLowerCase();
	const currentCode = (skill as any).internalCode;
	const { data: sameCatSkills } = await wikiService.getSkillsList({
		category: categoryKey,
		limit: 20,
	});

	const relatedSkills = sameCatSkills
		.filter((s: any) => s.internalCode !== currentCode)
		.map((s: any) => {
			let score = 10; // Same category guaranteed
			if (skill.elementName?.en && s.elementName?.en === skill.elementName?.en) {
				score += 5;
			}
			if (s.videoUrl) {
				score += 20;
			}
			return { score, skill: s };
		})
		.toSorted((a, b) => b.score - a.score)
		.slice(0, 3)
		.map((item) => item.skill);

	// Fetch override skills (Overdrive combinations)
	const skillHexId = (skill as any).skillId || (skill as any).skillID || id;
	const overrideSkills: OverrideSkillData[] =
		await wikiService.getOverrideSkillsForSkill(skillHexId);

	// Assets de cut-in (niers : modèle 3D, telop, son) — clé = code interne `skill_id_str`.
	const cutinEntry = getSkillCutin((skill as any).internalCode || id);

	// Vidéos officielles zukan (1 ou 2 variantes selon la technique).
	const videos = await fetchSkillVideos((skill as any).skillId || id);

	const breadcrumbJsonLd = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", item: "https://azalee.rosegriffon.fr", name: "Accueil", position: 1 },
			{
				"@type": "ListItem",
				item: "https://azalee.rosegriffon.fr/skill",
				name: "Techniques",
				position: 2,
			},
			{ "@type": "ListItem", name, position: 3 },
		],
	};

	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
			/>
			<SkillDetail
				skill={skill}
				name={name}
				desc={desc}
				category={category}
				element={element}
				relatedSkills={relatedSkills}
				overrideSkills={overrideSkills}
				videos={videos}
			/>
			{cutinEntry?.cutin && (
				<div className="mt-6">
					<SkillCutinSection
						cutin={cutinEntry.cutin}
						skillName={name}
						assetsAvailable={cutinHasAssets(cutinEntry.cutin.event_id_name)}
					/>
				</div>
			)}
		</>
	);
}
