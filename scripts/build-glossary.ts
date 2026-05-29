import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInagleService } from "../packages/inagle/src/service.ts";

async function main() {
	console.log("Loading inagle service to build translation glossary...");
	const svc = await createInagleService();

	const charactersList: any[] = [];
	const techniquesList: any[] = [];
	const aurasList: any[] = [];
	const passivesList: any[] = [];
	const teamsList: any[] = [];
	const itemsList: any[] = [];

	// 1. Characters
	console.log("Processing characters...");
	const chars = svc.characters.all();
	for (const c of chars) {
		const names = c.names || {};
		if (names.fr || names.en || names.ja) {
			charactersList.push({
				ja: names.ja || "",
				en: names.en || "",
				fr: names.fr || "",
				internalCode: c.internalCode || "",
			});
		}
	}

	// 2. Techniques (Moves)
	console.log("Processing techniques...");
	const skills = svc.skills.moves();
	for (const s of skills) {
		if (s.name_FR || s.name_EN || s.name_JA) {
			techniquesList.push({
				ja: s.name_JA || "",
				en: s.name_EN || "",
				fr: s.name_FR || "",
				category: s.categoryName || "",
				element: s.elementName || "",
			});
		}
	}

	// 3. Auras
	console.log("Processing auras...");
	const auras = svc.skills.auraAll();
	for (const a of auras) {
		if (a.name_FR || a.name_EN || a.name_JA) {
			aurasList.push({
				ja: a.name_JA || "",
				en: a.name_EN || "",
				fr: a.name_FR || "",
				subType: a.subType || "",
			});
		}
	}

	// 4. Passives
	console.log("Processing passives...");
	const passives = svc.skills.passiveAll();
	for (const p of passives) {
		if (p.name_FR || p.name_JA) {
			passivesList.push({
				ja: p.name_JA || "",
				fr: p.name_FR || "",
				boostType: p.boostType || "",
				scope: p.scope || "",
			});
		}
	}

	// 5. Teams
	console.log("Processing teams...");
	const teams = svc.teams.allTeams();
	for (const t of teams) {
		if (t.name_FR || t.name_EN || t.name_JA) {
			teamsList.push({
				ja: t.name_JA || "",
				en: t.name_EN || "",
				fr: t.name_FR || "",
			});
		}
	}

	// 6. Items
	console.log("Processing items...");
	const items = svc.items.allItems();
	for (const i of items) {
		const names = i.names || {};
		if (names.fr || names.en || names.ja) {
			itemsList.push({
				ja: names.ja || "",
				en: names.en || "",
				fr: names.fr || "",
				category: i.category || "",
			});
		}
	}

	const glossary = {
		_meta: {
			generatedAt: new Date().toISOString(),
			counts: {
				characters: charactersList.length,
				techniques: techniquesList.length,
				auras: aurasList.length,
				passives: passivesList.length,
				teams: teamsList.length,
				items: itemsList.length,
				total:
					charactersList.length +
					techniquesList.length +
					aurasList.length +
					passivesList.length +
					teamsList.length +
					itemsList.length,
			},
		},
		characters: charactersList,
		techniques: techniquesList,
		auras: aurasList,
		passives: passivesList,
		teams: teamsList,
		items: itemsList,
	};

	const outDir = join(process.cwd(), "data");
	mkdirSync(outDir, { recursive: true });

	const jsonPath = join(outDir, "glossary.json");
	writeFileSync(jsonPath, JSON.stringify(glossary, null, 2));
	console.log(`Glossary JSON saved to: ${jsonPath}`);
	console.log(`Total glossary entries: ${glossary._meta.counts.total}`);
}

main().catch(console.error);
