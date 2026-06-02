import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = import.meta.dir;
const DATA_DIR = path.join(__dirname, "../data");
const ENTITIES_DIR = path.join(__dirname, "../entries");

interface CharacterEntry {
	charaParamId: string;
	names?: { en?: string; fr?: string; ja?: string };
	sheetData?: any;
	[key: string]: any;
}

async function matchCharacters() {
	console.log("Loading Sheet Data...");
	const sheetContent = await fs.promises.readFile(
		path.join(DATA_DIR, "sheet_export.json"),
		"utf-8"
	);
	const sheetJson = JSON.parse(sheetContent);
	const sheet = sheetJson.sheets.Characters;

	if (!sheet) {
		console.error("Characters sheet not found");
		return;
	}

	// Load "ALL Basara" sheet for moveset/altMoveset (covers ALL characters, not just BASARA)
	const allBasaraSheet = sheetJson.sheets["ALL Basara"];
	const movesetMap = new Map<string, { moveset: string; altMoveset: string }>();
	if (allBasaraSheet) {
		for (let i = 1; i < allBasaraSheet.length; i++) {
			const abRow = allBasaraSheet[i];
			if (!abRow?.[0]) continue;
			const id = String(abRow[0]);
			const rawMoveset = String(abRow[14] || "").trim();
			const rawAltMoveset = String(abRow[15] || "").trim();
			const moveset =
				rawMoveset.startsWith("#N/A") || rawMoveset.startsWith("#REF") ? "" : rawMoveset;
			const altMoveset =
				rawAltMoveset.startsWith("#N/A") || rawAltMoveset.startsWith("#REF") ? "" : rawAltMoveset;
			if (moveset || altMoveset) {
				movesetMap.set(id, { moveset, altMoveset });
			}
		}
		console.log(`Indexed ${movesetMap.size} movesets from 'ALL Basara' sheet.`);
	} else {
		console.warn("'ALL Basara' sheet not found — movesets will be missing.");
	}

	// Header at row 0. Data starts row 1.
	const dataRows = sheet.slice(1);

	console.log("Loading Characters Entry...");
	const charPath = path.join(ENTITIES_DIR, "characters.json");
	if (!(await Bun.file(charPath).exists())) {
		console.error("characters.json not found");
		return;
	}
	const characters: CharacterEntry[] = JSON.parse(await fs.promises.readFile(charPath, "utf-8"));

	let matches = 0;
	let movesetMatches = 0;

	const cleanName = (str: string | undefined) => {
		if (!str) return "";
		return str.toLowerCase().replace(/[^a-z0-9]/g, "");
	};

	/** Strip Google Sheet formula errors (#N/A, #REF!, #VALUE!, etc.) */
	const cleanSheetValue = (val: any): string | undefined => {
		if (val == null) return undefined;
		const s = String(val).trim();
		if (
			!s ||
			s.startsWith("#N/A") ||
			s.startsWith("#REF") ||
			s.startsWith("#VALUE") ||
			s.startsWith("#ERROR")
		)
			return undefined;
		return s;
	};

	for (const row of dataRows) {
		if (!row || row.length < 5) continue;

		const sheetId = row[0];
		const nameLocalised = row[5];
		const playstyle = row[14];
		const firstMoves = row[15];

		// Stats
		const kick = Number(row[16]);
		const control = Number(row[17]);
		const technique = Number(row[18]);
		const pressure = Number(row[19]);
		const physical = Number(row[20]);
		const agility = Number(row[21]);
		const intelligence = Number(row[22]);

		const mainPath = row[24];
		const altPaths = row[25];

		if (!nameLocalised || nameLocalised === "Name(Localised)") continue;

		const searchName = cleanName(nameLocalised);

		// Lookup moveset from ALL Basara sheet by sheet ID
		const movesetData = movesetMap.get(String(sheetId));

		// Find matches
		// Note: Multiple characters might have same name (Variants). We should match ALL of them.
		const foundChars = characters.filter((char) => {
			const en = cleanName(char.names?.en);
			const fr = cleanName(char.names?.fr);
			return en === searchName || fr === searchName;
		});

		if (foundChars.length > 0) {
			matches += foundChars.length;
			if (movesetData) movesetMatches += foundChars.length;
			for (const char of foundChars) {
				char.sheetData = {
					sheetId,
					matchedName: nameLocalised,
					playstyle: cleanSheetValue(playstyle),
					firstMoves: cleanSheetValue(firstMoves),
					...(movesetData
						? { moveset: movesetData.moveset, altMoveset: movesetData.altMoveset }
						: {}),
					stats: {
						kick,
						control,
						technique,
						pressure,
						physical,
						agility,
						intelligence,
					},
					paths: {
						main: cleanSheetValue(mainPath),
						alt: cleanSheetValue(altPaths),
					},
				};
			}
		}
	}

	console.log(`Matched ${matches} characters (${movesetMatches} with movesets).`);

	// --- PASS 2: Match remaining characters via kanji name from the sheet ---
	// Build a map: kanji (col 2) -> row for sheet entries
	const sheetByKanji = new Map<string, any[]>();
	for (const row of dataRows) {
		if (!row || row.length < 5) continue;
		const kanji = String(row[2] || "").trim();
		if (kanji && !sheetByKanji.has(kanji)) {
			sheetByKanji.set(kanji, row);
		}
	}

	let kanjiMatches = 0;
	for (const char of characters) {
		if (char.sheetData) continue; // already matched
		const ja = char.names?.ja;
		if (!ja) continue;

		const row = sheetByKanji.get(ja);
		if (!row) continue;

		const sheetId = row[0];
		const nameLocalised = row[5];
		const playstyle = row[14];
		const firstMoves = row[15];
		const kick = Number(row[16]);
		const control = Number(row[17]);
		const technique = Number(row[18]);
		const pressure = Number(row[19]);
		const physical = Number(row[20]);
		const agility = Number(row[21]);
		const intelligence = Number(row[22]);
		const mainPath = row[24];
		const altPaths = row[25];

		if (kick === 0 && control === 0) continue; // no real stats

		const movesetData = movesetMap.get(String(sheetId));
		char.sheetData = {
			sheetId,
			matchedName: nameLocalised,
			matchedVia: "kanji",
			playstyle: cleanSheetValue(playstyle),
			firstMoves: cleanSheetValue(firstMoves),
			...(movesetData
				? { moveset: movesetData.moveset, altMoveset: movesetData.altMoveset }
				: {}),
			stats: { kick, control, technique, pressure, physical, agility, intelligence },
			paths: { main: cleanSheetValue(mainPath), alt: cleanSheetValue(altPaths) },
		};
		kanjiMatches++;
	}
	console.log(`Pass 2 (kanji): matched ${kanjiMatches} additional characters.`);

	// --- PASS 3: Propagate stats from matched variants via JA name ---
	// Only copy stats from a variant with the SAME rarity to avoid inflating Normal stats
	// with Héros/BASARA values.
	const matchedByJaAndRarity = new Map<string, any>();
	for (const char of characters) {
		if (!char.sheetData?.stats) continue;
		const ja = char.names?.ja;
		const rarity = char.rarity ?? "Normal";
		if (ja) {
			const key = `${ja}::${rarity}`;
			if (!matchedByJaAndRarity.has(key)) {
				matchedByJaAndRarity.set(key, char.sheetData);
			}
		}
	}

	let variantMatches = 0;
	for (const char of characters) {
		if (char.sheetData) continue;
		const ja = char.names?.ja;
		if (!ja) continue;

		const rarity = char.rarity ?? "Normal";
		const refData = matchedByJaAndRarity.get(`${ja}::${rarity}`);
		if (!refData?.stats) continue;

		// Copy full sheetData (playstyle/moveset should match for same character and rarity)
		char.sheetData = {
			sheetId: refData.sheetId,
			matchedName: refData.matchedName,
			matchedVia: "ja-variant",
			playstyle: refData.playstyle,
			firstMoves: refData.firstMoves,
			moveset: refData.moveset,
			altMoveset: refData.altMoveset,
			stats: { ...refData.stats },
			paths: refData.paths ? { ...refData.paths } : undefined,
		};
		variantMatches++;
	}
	console.log(`Pass 3 (JA variant, same rarity): matched ${variantMatches} additional characters.`);

	// --- PASS 4: Fill remaining from growth table ---
	// Use the game's growth table to calculate stats for characters still unmatched
	const growthTablePath = path.join(
		DATA_DIR,
		"common/gamedata/character/growth_table_config_0.00.00.00.cfg.bin.json"
	);
	let growthTableMatches = 0;
	if (await Bun.file(growthTablePath).exists()) {
		const growthConfig = JSON.parse(await fs.promises.readFile(growthTablePath, "utf-8"));
		const mainList = growthConfig.lists.find(
			(l: any) => l.name === "m_growthTableMainList"
		)?.values;
		if (mainList) {
			const mainMap = new Map<string, any>();
			for (const entry of mainList) {
				mainMap.set(`${entry.mainPosition}-${entry.growthPattern}-${entry.charaRank}`, entry);
			}

			const rarityToGrowthRank = (code: number): number => {
				switch (code) {
					case 0:
						return 0;
					case 2:
						return 2;
					case 3:
						return 3;
					case 4:
						return 4;
					case 5:
					case 6:
					case 7:
					case 20:
						return 5;
					default:
						return code <= 5 ? code : 5;
				}
			};

			const computeGrowthStats = (pos: number, growthPattern: number, rarityCode: number) => {
				const rank = rarityToGrowthRank(rarityCode);
				const pattern = (growthPattern ?? 0) >= 2 ? 0 : (growthPattern ?? 0);
				const entry = mainMap.get(`${pos}-${pattern}-${rank}`);
				if (!entry) return null;
				// Always use lv50 stats — the community sheet convention for all rarities
				return {
					kick: entry.Kc_50,
					control: entry.Cr_50,
					technique: entry.Tc_50,
					pressure: entry.Pr_50,
					physical: entry.Ps_50,
					agility: entry.Ag_50,
					intelligence: entry.It_50,
				};
			};

			for (const char of characters) {
				if (char.sheetData) continue;
				const stats = computeGrowthStats(
					char.positionRaw,
					char.growthPattern ?? 0,
					char.rarityCode ?? 0
				);
				if (!stats) continue;

				char.sheetData = {
					matchedVia: "growth-table",
					stats,
				};
				char.stats = { lv99: stats };
				growthTableMatches++;
			}

			// --- PASS 5: Fix non-Normal characters whose stats are below growth-table ---
			// The community sheet doesn't distinguish rarity — a BASARA "Gazelle" gets the
			// same stats as a Normal "Gazelle". Also, stale data from previous pipeline runs
			// (e.g. match-basara.ts Basara sheet stats) may have been saved to entries.
			// Always compare with growth-table and upgrade if higher.
			let rarityFixed = 0;
			for (const char of characters) {
				if (char.rarityCode === 0) continue; // Normal — already correct
				const rank = rarityToGrowthRank(char.rarityCode ?? 0);
				if (rank === 0) continue; // Same as Normal

				const gtStats = computeGrowthStats(
					char.positionRaw,
					char.growthPattern ?? 0,
					char.rarityCode ?? 0
				);
				if (!gtStats) continue;

				const currentTotal = Object.values(char.sheetData?.stats || {}).reduce(
					(a: number, b: any) => a + (Number(b) || 0),
					0
				);
				const gtTotal = Object.values(gtStats).reduce(
					(a: number, b: any) => a + (Number(b) || 0),
					0
				);

				// If growth table stats for this rarity are higher, use them
				if (gtTotal > currentTotal) {
					char.sheetData = {
						...char.sheetData,
						matchedVia: "growth-table-rarity-fix",
						stats: gtStats,
					};
					char.stats = { lv99: gtStats };
					rarityFixed++;
				}
			}
			console.log(`Pass 5 (rarity fix): upgraded ${rarityFixed} BASARA/Héros characters.`);
		}
	}
	console.log(`Pass 4 (growth table): matched ${growthTableMatches} additional characters.`);

	const totalMatched = matches + kanjiMatches + variantMatches + growthTableMatches;
	const remaining = characters.filter((c) => !c.sheetData).length;
	console.log(
		`\nTotal matched: ${totalMatched} / ${characters.length} (${remaining} remaining without stats)`
	);

	console.log("Saving characters.json...");
	await fs.promises.writeFile(charPath, JSON.stringify(characters, null, 2));
	console.log("Done.");
}

matchCharacters().catch(console.error);
