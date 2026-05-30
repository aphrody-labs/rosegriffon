import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_ROOT } from "@rose-griffon/inagle/core/paths.ts";
import { preloadCharacterEnrichment } from "@rose-griffon/inagle/entities/character.ts";
import {
	buildCapsuleDatabase,
	buildChangeAuraSkillDatabase,
	buildCharaCostumeDatabase,
	buildCharaExpTableDatabase,
	buildCtrlCharaDatabase,
	buildDictionaryDatabase,
	buildEnjoyModeTeamDatabase,
	buildGalleryDatabase,
	buildGrowthTableDatabase,
	buildOpponentTeamDatabase,
	buildTrickDatabase,
	buildActivityPhotoDatabase,
	buildChatEmoteDatabase,
	buildNameplateDatabase,
	buildPerformanceDatabase,
	buildPhaseTitleDatabase,
	buildSceneArchiveDatabase,
	buildStadiumDatabase,
	buildCharaMenuResourceDatabase,
} from "@rose-griffon/inagle/parsers/index.js";
import { buildOverrideSkillDatabase } from "@rose-griffon/inagle/parsers/override-skill-config.ts";
import { createInagleService } from "@rose-griffon/inagle/service.ts";

const __dirname = import.meta.dir;
const ENTRIES_DIR = path.resolve(__dirname, "../../../packages/inagle/src/entries");

async function main() {
	console.log("Pre-loading enrichment data (ctrl-chara, growth lv1)...");
	await preloadCharacterEnrichment();

	console.log("Initializing Inagle Service...");
	const service = await createInagleService();

	console.log("Fetching Characters...");
	const allCharacters = service.characters.all();

	// Strict filtering: Must have valid FR name and description
	const characters = allCharacters.filter((c) => {
		const hasName = c.names?.fr && c.names.fr !== "?" && c.names.fr !== "Unknown";
		const hasDesc =
			c.descriptions?.fr && c.descriptions.fr !== "?" && c.descriptions.fr.trim() !== "";
		return hasName && hasDesc;
	});

	await fs.writeFile(
		path.join(ENTRIES_DIR, "characters.json"),
		JSON.stringify(characters, null, 2)
	);
	console.log(`Saved ${characters.length} characters (filtered from ${allCharacters.length}).`);

	console.log("Fetching Items...");
	const items = service.items.allItems();
	await fs.writeFile(path.join(ENTRIES_DIR, "items.json"), JSON.stringify(items, null, 2));
	console.log(`Saved ${items.length} items.`);

	console.log("Fetching Skills...");
	const skills = service.skills.all();
	await fs.writeFile(path.join(ENTRIES_DIR, "skills.json"), JSON.stringify(skills, null, 2));
	console.log(`Saved ${skills.length} skills.`);

	console.log("Fetching Passives...");
	const passives = service.skills.passiveAll();
	await fs.writeFile(path.join(ENTRIES_DIR, "passives.json"), JSON.stringify(passives, null, 2));
	console.log(`Saved ${passives.length} passives.`);

	try {
		console.log("Fetching Auras...");
		const allAuras = service.skills.auraAll();

		// Initial Separation
		let keshins = allAuras.filter((a) => a.subType === "Keshin");
		let souls = allAuras.filter((a) => a.subType === "Soul");
		const awakenings = allAuras.filter((a) => a.subType === "Awakening");
		const modeChanges = allAuras.filter((a) => a.subType === "ModeChange");
		const miximax = allAuras.filter((a) => a.subType === "Miximax");
		let genericAuras = allAuras.filter((a) => !a.subType || a.subType === "Aura");

		// 1. Clean Souls: Must have "Totem" in name
		// Those without "Totem" are usually Keshins that use 'wks' prefix (e.g. Arthur)
		const validSouls = souls.filter(
			(s) => s.name_FR?.toLowerCase().includes("totem") || s.name_FR?.toLowerCase().includes("soul")
		);
		const invalidSouls = souls.filter((s) => !validSouls.includes(s));

		souls = validSouls;
		keshins.push(...invalidSouls); // Move to Keshins

		// 2. Clean Keshins: Check for Awakenings (Éveil)
		const keshinAwakenings = keshins.filter(
			(k) =>
				k.name_FR?.toLowerCase().includes("éveil") || k.name_FR?.toLowerCase().includes("awakening")
		);
		keshins = keshins.filter((k) => !keshinAwakenings.includes(k));
		awakenings.push(...keshinAwakenings); // Move to Awakenings

		// 3. Clean Generic Auras / Miximax
		// Remove entries with fallback names like "Aura (code)" or empty names
		genericAuras = genericAuras.filter((a) => {
			if (!a.name_FR) return false;
			if (a.name_FR.startsWith("Aura (")) return false; // Unnamed fallback
			if (a.name_FR.startsWith("Mode (")) return false;
			if (a.name_FR.startsWith("Esprit Guerrier (")) return false;
			return true;
		});

		await fs.writeFile(path.join(ENTRIES_DIR, "keshins.json"), JSON.stringify(keshins, null, 2));
		console.log(`Saved ${keshins.length} keshins.`);

		await fs.writeFile(path.join(ENTRIES_DIR, "souls.json"), JSON.stringify(souls, null, 2));
		console.log(`Saved ${souls.length} souls.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "awakenings.json"),
			JSON.stringify(awakenings, null, 2)
		);
		console.log(`Saved ${awakenings.length} awakenings.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "mode_changes.json"),
			JSON.stringify(modeChanges, null, 2)
		);
		console.log(`Saved ${modeChanges.length} mode changes.`);

		await fs.writeFile(path.join(ENTRIES_DIR, "miximax.json"), JSON.stringify(miximax, null, 2));
		console.log(`Saved ${miximax.length} miximax.`);

		await fs.writeFile(path.join(ENTRIES_DIR, "auras.json"), JSON.stringify(genericAuras, null, 2));
		console.log(`Saved ${genericAuras.length} generic auras.`);
	} catch (e) {
		console.error("Failed to save auras:", e);
	}

	try {
		console.log("Fetching Basara...");
		const basara = service.basara.all();
		await fs.writeFile(path.join(ENTRIES_DIR, "basara.json"), JSON.stringify(basara, null, 2));
		console.log(`Saved ${basara.length} basara characters.`);
	} catch (e) {
		console.error("Failed to save basara:", e);
	}

	try {
		console.log("Fetching Teams...");
		const teams = service.teams.allTeams();
		await fs.writeFile(path.join(ENTRIES_DIR, "teams.json"), JSON.stringify(teams, null, 2));
		console.log(`Saved ${teams.length} teams.`);
	} catch (e) {
		console.error("Failed to save teams:", e);
	}

	try {
		console.log("Fetching Drops...");
		// drops API uses Maps, convert to arrays/objects
		const dropsData = {
			battles: Array.from(service.drops.getAllBattles().entries()),
			tables: Array.from(service.drops.getAllTables().entries()),
			treasures: service.drops.getAllTreasures(),
		};

		await fs.writeFile(path.join(ENTRIES_DIR, "drops.json"), JSON.stringify(dropsData, null, 2));
		console.log(`Saved drops data.`);
	} catch (e) {
		console.error("Failed to save drops:", e);
	}

	try {
		console.log("Fetching Quests...");
		const quests = service.quests.all();
		await fs.writeFile(path.join(ENTRIES_DIR, "quests.json"), JSON.stringify(quests, null, 2));
		console.log(`Saved ${quests.length} quests.`);
	} catch (e) {
		console.error("Failed to save quests:", e);
	}

	try {
		console.log("Fetching Override Skills...");
		const overrideDb = await buildOverrideSkillDatabase(DATA_ROOT);

		// Build skill name lookup from already-generated skills
		const skillsJson = await fs.readFile(path.join(ENTRIES_DIR, "skills.json"), "utf-8");
		const allSkills: any[] = JSON.parse(skillsJson);
		const skillMap = new Map<string, any>();
		for (const s of allSkills) {
			if (s.skillIDStr) skillMap.set(s.skillIDStr, s);
			if (s.skillID) skillMap.set(s.skillID, s);
		}

		const overrideSkills = overrideDb.resolved.map((override) => {
			const overrideSkill = skillMap.get(override.overrideSkillId);
			return {
				override_skill_id: override.overrideSkillId,
				name_fr: overrideSkill?.name_FR || null,
				name_en: overrideSkill?.name_EN || null,
				name_ja: overrideSkill?.name_JA || null,
				element_id: overrideSkill?.element || 0,
				category_id: overrideSkill?.category || 0,
				power_min: overrideSkill?.power_min || 0,
				power_max: overrideSkill?.power_max || 0,
				conditions: override.conditions.map((c) => ({
					condition_type: c.conditionType,
					required_skills: c.requiredSkills.map((rs) => {
						const skill = skillMap.get(rs.skillId);
						return {
							skill_id: rs.skillId,
							name_fr: skill?.name_FR || null,
							name_en: skill?.name_EN || null,
							num: rs.num,
						};
					}),
				})),
			};
		});

		await fs.writeFile(
			path.join(ENTRIES_DIR, "override_skills.json"),
			JSON.stringify(overrideSkills, null, 2)
		);
		console.log(`Saved ${overrideSkills.length} override skills.`);
	} catch (e) {
		console.error("Failed to save override skills:", e);
	}

	// ========================================================================
	// New parser entries (Phase 2)
	// ========================================================================

	try {
		console.log("Generating new parser entries...");

		const [
			expTable,
			growthTable,
			tricks,
			gallery,
			capsule,
			costumes,
			ctrlChara,
			changeAura,
			opponents,
			enjoyTeams,
			dictionary,
			activityPhotos,
			chatEmotes,
			nameplates,
			performances,
			phaseTitles,
			sceneArchives,
			stadiums,
			charaMenuResource,
		] = await Promise.all([
			buildCharaExpTableDatabase(DATA_ROOT),
			buildGrowthTableDatabase(DATA_ROOT),
			buildTrickDatabase(DATA_ROOT),
			buildGalleryDatabase(DATA_ROOT),
			buildCapsuleDatabase(DATA_ROOT),
			buildCharaCostumeDatabase(DATA_ROOT),
			buildCtrlCharaDatabase(DATA_ROOT),
			buildChangeAuraSkillDatabase(DATA_ROOT),
			buildOpponentTeamDatabase(DATA_ROOT),
			buildEnjoyModeTeamDatabase(DATA_ROOT),
			buildDictionaryDatabase(DATA_ROOT),
			buildActivityPhotoDatabase(DATA_ROOT),
			buildChatEmoteDatabase(DATA_ROOT),
			buildNameplateDatabase(DATA_ROOT),
			buildPerformanceDatabase(DATA_ROOT),
			buildPhaseTitleDatabase(DATA_ROOT),
			buildSceneArchiveDatabase(DATA_ROOT),
			buildStadiumDatabase(DATA_ROOT),
			buildCharaMenuResourceDatabase(DATA_ROOT),
		]);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "exp_table.json"),
			JSON.stringify(expTable.expTable, null, 2)
		);
		console.log(`Saved ${expTable.expTable.length} exp table entries.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "growth_tables.json"),
			JSON.stringify(
				{
					lv1: growthTable.lv1,
					lv30: growthTable.lv30,
					main: growthTable.main,
					sub: growthTable.sub,
				},
				null,
				2
			)
		);
		console.log(
			`Saved growth tables (lv1=${growthTable.lv1.length}, lv30=${growthTable.lv30.length}, main=${growthTable.main.length}, sub=${growthTable.sub.length}).`
		);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "tricks.json"),
			JSON.stringify(tricks.tricks, null, 2)
		);
		console.log(`Saved ${tricks.tricks.length} tricks.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "gallery.json"),
			JSON.stringify(gallery.galleries, null, 2)
		);
		console.log(`Saved ${gallery.galleries.length} gallery entries.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "capsules.json"),
			JSON.stringify(
				{
					prizes: capsule.prizes,
					prizeTables: capsule.prizeTables,
					lotRankRates: capsule.lotRankRates,
					configs: capsule.configs,
					weaponColorTables: capsule.weaponColorTables,
				},
				null,
				2
			)
		);
		console.log(
			`Saved capsules (${capsule.prizes.length} prizes, ${capsule.prizeTables.length} tables).`
		);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "costumes.json"),
			JSON.stringify(costumes.costumes, null, 2)
		);
		console.log(`Saved ${costumes.costumes.length} costumes.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "ctrl_characters.json"),
			JSON.stringify(ctrlChara.characters, null, 2)
		);
		console.log(`Saved ${ctrlChara.characters.length} controllable characters.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "change_aura_skills.json"),
			JSON.stringify(changeAura.data, null, 2)
		);
		console.log(`Saved ${changeAura.data.length} aura skill change mappings.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "opponent_teams.json"),
			JSON.stringify(
				{
					opponents: opponents.opponents,
					matchDifficulties: opponents.matchDifficulties,
					practiceMatches: opponents.practiceMatches,
				},
				null,
				2
			)
		);
		console.log(`Saved ${opponents.opponents.length} opponent teams.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "enjoy_mode_teams.json"),
			JSON.stringify(enjoyTeams.teams, null, 2)
		);
		console.log(`Saved ${enjoyTeams.teams.length} enjoy mode teams.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "dictionary.json"),
			JSON.stringify(
				{
					habitats: dictionary.habitats,
					observations: dictionary.observations,
				},
				null,
				2
			)
		);
		console.log(
			`Saved dictionary (${dictionary.habitats.length} habitats, ${dictionary.observations.length} observations).`
		);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "activity_photos.json"),
			JSON.stringify(activityPhotos.rewards, null, 2)
		);
		console.log(`Saved ${activityPhotos.rewards.length} activity photo rewards.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "chat_emotes.json"),
			JSON.stringify(chatEmotes.emotes, null, 2)
		);
		console.log(`Saved ${chatEmotes.emotes.length} chat emotes.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "nameplates.json"),
			JSON.stringify(nameplates.nameplates, null, 2)
		);
		console.log(`Saved ${nameplates.nameplates.length} nameplates.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "performances.json"),
			JSON.stringify(performances.performances, null, 2)
		);
		console.log(`Saved ${performances.performances.length} performances.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "phase_titles.json"),
			JSON.stringify(phaseTitles.titles, null, 2)
		);
		console.log(`Saved ${phaseTitles.titles.length} phase titles.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "scene_archives.json"),
			JSON.stringify(sceneArchives.scenes, null, 2)
		);
		console.log(`Saved ${sceneArchives.scenes.length} scene archives.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "stadiums.json"),
			JSON.stringify(stadiums.stadiums, null, 2)
		);
		console.log(`Saved ${stadiums.stadiums.length} stadiums.`);

		await fs.writeFile(
			path.join(ENTRIES_DIR, "chara_menu_resource.json"),
			JSON.stringify(
				{
					basePath: charaMenuResource.basePath,
					template: charaMenuResource.template,
					overrides: charaMenuResource.overrides,
				},
				null,
				2
			)
		);
		console.log(`Saved ${charaMenuResource.overrides.length} character menu resources.`);
	} catch (e) {
		console.error("Failed to generate new parser entries:", e);
	}

	console.log(`Done. Entries generated in ${ENTRIES_DIR}`);
}

main().catch((error) => {
	console.error("Error generating entries:", error);
	process.exit(1);
});
