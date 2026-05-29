/**
 * Match Hero characters from Google Sheet to entries/characters.json.
 * Matches by English name (Name Localised from Hero tab).
 * Sets rarity to "Héros" and enriches with stats/playstyle/moveset.
 *
 * IMPORTANT: Selects exactly ONE character per hero name to avoid duplicates.
 * Priority: _5000 suffix (hero form) > Victory Road > Ares/Orion > Galaxy > GO > Original
 *
 * Run with: npx tsx scripts/match-heroes.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = import.meta.dir;
const DATA_DIR = path.join(__dirname, "../data");
const ENTRIES_DIR = path.join(__dirname, "../entries");

interface CharacterEntry {
	charaParamId: string;
	names?: { en?: string; fr?: string; ja?: string };
	sheetData?: any;
	rarity?: string;
	rarityCode?: number;
	internalCode?: string;
	series?: string;
	[key: string]: any;
}

interface HeroVariant {
	playstyle: string;
	moveset: string[];
	stats: {
		kick: number;
		control: number;
		technique: number;
		pressure: number;
		physical: number;
		agility: number;
		intelligence: number;
	};
}

/**
 * Series priority for hero selection.
 * Higher = preferred. Victory Road characters are the main target
 * since heroes are a VR game mechanic.
 */
const SERIES_PRIORITY: Record<string, number> = {
	"Victory Road": 100,
	Ares: 80,
	Orion: 75,
	Galaxy: 70,
	"Chrono Stone": 60,
	"Inazuma Eleven GO": 50,
	"Inazuma Eleven 3": 45,
	"Inazuma Eleven 2": 42,
	"Inazuma Eleven": 40,
};

function getSeriesPriority(series: string | undefined): number {
	if (!series) return 0;
	return SERIES_PRIORITY[series] ?? 5;
}

/**
 * Pick the best single character for a hero from a list of candidates.
 * Priority:
 * 1. Highest series priority (Victory Road > Ares > ... > Other)
 *    VR versions have constellations, older _5000 versions don't.
 * 2. Within same series: _5000 suffix preferred (hero-specific game form)
 * 3. First match (stable ordering)
 */
function pickBestHero(candidates: CharacterEntry[]): CharacterEntry {
	const sorted = [...candidates].sort((a, b) => {
		// Deprioritize VR Legends re-releases (c11250*) — prefer original era version
		const aVRLegend = a.internalCode?.startsWith("c11250") ? 1 : 0;
		const bVRLegend = b.internalCode?.startsWith("c11250") ? 1 : 0;
		if (aVRLegend !== bVRLegend) return aVRLegend - bVRLegend;
		const seriesDiff = getSeriesPriority(b.series) - getSeriesPriority(a.series);
		if (seriesDiff !== 0) return seriesDiff;
		// Within same series, prefer NON-_5000 (normal form visible in listing)
		const a5000 = a.internalCode?.includes("_5000") ? 1 : 0;
		const b5000 = b.internalCode?.includes("_5000") ? 1 : 0;
		return a5000 - b5000;
	});
	return sorted[0];
}

/**
 * Rarity name from rarityCode (original game rarity before hero override).
 *
 * Official FR names from game (system_text NOUN_INFO 76-82):
 *   Normal, Expérimenté, Émérite, Légendaire, Héros, BASARA
 */
function rarityFromCode(code: number | undefined): string {
	switch (code) {
		case 0:
		case 1:
			return "Normal";
		case 2:
			return "Expérimenté";
		case 3:
			return "Émérite";
		case 4:
		case 5:
		case 6:
		case 7:
			return "Légendaire";
		case 20:
			return "BASARA";
		default:
			return "Normal";
	}
}

async function main() {
	const sheetContent = await fs.promises.readFile(
		path.join(DATA_DIR, "sheet_export.json"),
		"utf-8"
	);
	const sheetJson = JSON.parse(sheetContent);
	const heroSheet = sheetJson.sheets.Hero;
	if (!heroSheet) {
		console.error("Hero sheet not found");
		return;
	}

	console.log("Hero sheet rows:", heroSheet.length - 1);

	// Group hero rows by English name (column 3)
	const heroByName = new Map<string, HeroVariant[]>();
	for (let i = 1; i < heroSheet.length; i++) {
		const row = heroSheet[i];
		if (!row[0] || !row[3]) continue;
		const name = String(row[3]).trim();

		// Skip broken entries
		if (name.startsWith("#N/A")) continue;

		const variant: HeroVariant = {
			playstyle: String(row[7] || ""),
			moveset: String(row[8] || "")
				.split("\n")
				.filter(Boolean),
			stats: {
				kick: Number(row[9]) || 0,
				control: Number(row[10]) || 0,
				technique: Number(row[11]) || 0,
				pressure: Number(row[12]) || 0,
				physical: Number(row[13]) || 0,
				agility: Number(row[14]) || 0,
				intelligence: Number(row[15]) || 0,
			},
		};

		const existing = heroByName.get(name);
		if (existing) {
			existing.push(variant);
		} else {
			heroByName.set(name, [variant]);
		}
	}

	console.log(`Unique hero names: ${heroByName.size}`);

	// Load characters
	const charPath = path.join(ENTRIES_DIR, "characters.json");
	const characters: CharacterEntry[] = JSON.parse(await fs.promises.readFile(charPath, "utf-8"));

	// ========================================
	// STEP 1: Reset sheet-matched heroes back to original rarity
	// Keep hero-config tagged heroes (heroType in sheetData) — those are
	// Fire/Black/Pink variants detected by the parser, not the sheet.
	// ========================================
	let resetCount = 0;
	for (const c of characters) {
		if (c.rarity === "Héros" && !c.sheetData?.heroType) {
			c.rarity = rarityFromCode(c.rarityCode);
			// Clean hero-specific sheetData fields
			if (c.sheetData) {
				delete c.sheetData.matchedName;
				delete c.sheetData.heroVariants;
				delete c.sheetData.playstyle;
				delete c.sheetData.firstMoves;
				// Keep stats — they come from match-characters.ts too
			}
			resetCount++;
		}
	}
	console.log(
		`Reset ${resetCount} sheet-matched heroes (kept ${characters.filter((c) => c.sheetData?.heroType).length} hero-config variants).`
	);

	// ========================================
	// STEP 2: Match heroes — ONE per hero name
	// ========================================
	const cleanName = (s: string | undefined) => (s ? s.toLowerCase().replace(/[^a-z0-9]/g, "") : "");

	// Manual overrides: sheet full name -> game name
	// Many VR-original characters only have first names in game data
	const NAME_OVERRIDES: Record<string, string> = {
		"Paolo Bianchi": "Paolo",
		"Meridia Althoff": "Meridia",
		"Samguk Han": "Samguk",
		"Quentin Cinquedea": "Quentin",
		"Ozrock Boldar": "Ozrock",
		"Arculus Orbes": "Arculus",
		"Circulus Corona": "Circulus",
		"Ruger Baran": "Ruger",
		"Gandares Baran": "Gandares",
		"Terry Archibald": "Terry",
		"Plink Powai": "Plink",
		"Rondula Flehl": "Rondula",
		"Sonny Wright": "Sonny",
		"Elliot Ember": "Elliot",
		"Heath Moore": "Heath",
		"Aiden Froste": "Aiden",
		"Raika Shinohara": "Raika",
		"Cedric Freud": "Cedric",
		"Thierry Reyes": "Thierry",
		"Alix La Fontaine": "Alix",
		"Nikas Himmelstein": "Nikas",
		"Goldie Lemmon": "Goldie",
		"Gabriel Garcia": "Gabriel",
		"Jean-Pierre Lapin": "Jean-Pierre",
		"Fei Rune": "Fei",
		"Riccardo Di Rigo": "Riccardo",
	};

	let matched = 0;
	let charUpdated = 0;

	for (const [heroName, variants] of heroByName) {
		const searchNames = [heroName];
		if (NAME_OVERRIDES[heroName]) {
			searchNames.push(NAME_OVERRIDES[heroName]);
		}

		// Find ALL characters matching any of the search names
		// Exclude BASARA and MixiMax forms (c05028*)
		const found = characters.filter((c) => {
			if (c.rarity === "BASARA") return false;
			if (c.internalCode?.startsWith("c05028")) return false;
			const en = cleanName(c.names?.en);
			const fr = cleanName(c.names?.fr);
			return searchNames.some((n) => {
				const clean = cleanName(n);
				return en === clean || fr === clean;
			});
		});

		if (found.length === 0) {
			console.log(`NOT FOUND: ${heroName}`);
			continue;
		}

		matched++;
		const primaryVariant = variants[0];
		const totalStats = Object.values(primaryVariant.stats).reduce((a, b) => a + b, 0);

		// Pick only ONE character — the best match
		const best = pickBestHero(found);
		best.rarity = "Héros";
		// Build moveset/altMoveset from hero variants (always override)
		const heroMoveset = primaryVariant.moveset.join("\n");
		const altVariant = variants.length > 1 ? variants[1] : undefined;
		const heroAltMoveset = altVariant ? altVariant.moveset.join("\n") : heroMoveset;

		best.sheetData = {
			...best.sheetData,
			matchedName: heroName,
			heroVariants: variants.map((v) => ({
				playstyle: v.playstyle,
				moveset: v.moveset,
			})),
			playstyle: primaryVariant.playstyle,
			firstMoves: primaryVariant.moveset.slice(0, 3).join(", "),
			moveset: heroMoveset,
			altMoveset: heroAltMoveset,
			stats: primaryVariant.stats,
		};
		charUpdated++;

		const seriesInfo = best.series || "?";
		const codeInfo = best.internalCode || "?";
		console.log(
			`MATCHED: ${heroName} -> ${best.charaParamId} (${seriesInfo}, ${codeInfo})` +
				(found.length > 1 ? ` [picked 1/${found.length}]` : "") +
				` | Variants: ${variants.map((v) => v.playstyle).join("/")}` +
				` | Stats: ${totalStats}`
		);
	}

	console.log(`\n=== SUMMARY ===`);
	console.log(`Hero names matched: ${matched} / ${heroByName.size}`);
	console.log(`Characters updated: ${charUpdated}`);

	const totalHeroes = characters.filter((c) => c.rarity === "Héros").length;
	console.log(`Total Héros in entries: ${totalHeroes}`);
	console.log(`Expected: ${heroByName.size} (one per unique hero name)`);

	if (totalHeroes !== heroByName.size) {
		console.warn(
			`WARNING: Expected ${heroByName.size} heroes but got ${totalHeroes}. Check for issues.`
		);
	}

	if (charUpdated > 0 || resetCount > 0) {
		await fs.promises.writeFile(charPath, JSON.stringify(characters, null, 2));
		console.log("Saved characters.json");
	}
}

main().catch(console.error);
