export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { OverrideSkillData } from "@/components/wiki/OverrideSkillSection";
import { SkillDetail } from "@/components/wiki/SkillDetail";
import { wikiService } from "@/lib/wiki-service";

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
			/>
		</>
	);
}
