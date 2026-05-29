import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = import.meta.dir;
const DATA_DIR = path.join(__dirname, "../data");
const ENTITIES_DIR = path.join(__dirname, "../entries");

interface AuraEntry {
	auraId: string;
	name_FR?: string;
	name_EN?: string;
	subType?: string;
	sheetData?: any;
	[key: string]: any;
}

async function matchHyperMoves() {
	console.log("Loading Sheet Data...");
	const sheetContent = await fs.readFile(path.join(DATA_DIR, "sheet_export.json"), "utf-8");
	const sheetJson = JSON.parse(sheetContent);
	const hyperMovesRows: string[][] = sheetJson.sheets["Hyper Moves"];

	if (!hyperMovesRows) {
		console.error("Hyper Moves sheet not found!");
		return;
	}

	// Skip header rows (assume first 2 rows are headers/info based on previous cat)
	// Row 0: "All of the following..."
	// Row 1: "Name", "Type", ...
	const dataRows = hyperMovesRows.slice(2);

	console.log("Loading Aura Entries...");
	const files = [
		"awakenings.json",
		"miximax.json",
		"keshins.json",
		"souls.json",
		"mode_changes.json",
		"auras.json",
	];
	const entries: Record<string, AuraEntry[]> = {};

	for (const file of files) {
		try {
			const content = await fs.readFile(path.join(ENTITIES_DIR, file), "utf-8");
			entries[file] = JSON.parse(content);
		} catch (_e) {
			console.warn(`Skipping ${file} (not found)`);
			entries[file] = [];
		}
	}

	let matches = 0;
	let enrichedCount = 0;

	const cleanName = (str: string | undefined) => {
		if (!str) return "";
		return str
			.toLowerCase()
			.replace(/mix 'n' match: /g, "")
			.replace(/miximax trans\.: /g, "")
			.replace(/transfo\. miximax : /g, "")
			.replace(/totem /g, "")
			.replace(/soul /g, "")
			.replace(/fighting spirit /g, "")
			.replace(/keshin /g, "")
			.replace(/[^a-z0-9]/g, ""); // Remove non-alphanumeric
	};

	for (const row of dataRows) {
		const name = row[0];
		if (!name?.trim()) continue;

		const passive = row[3];
		const hissatsuName = row[4];
		const hissatsuType = row[5];
		const hissatsuElement = row[6];
		const hissatsuPower = row[7];
		const buffName = row[8];
		const buffEffect = row[9];

		// Search for match in all files
		let matchedEntry: AuraEntry | null = null;
		let _matchedFile = "";

		const searchNameClean = cleanName(name);

		for (const file of files) {
			const fileEntries = entries[file];

			// Priority 1: Exact Clean Match
			let found = fileEntries.find((e) => {
				const en = cleanName(e.name_EN);
				const fr = cleanName(e.name_FR);
				return en === searchNameClean || fr === searchNameClean;
			});

			// Priority 2: Inclusion Match (if exact fails)
			if (!found && searchNameClean.length > 3) {
				found = fileEntries.find((e) => {
					const en = cleanName(e.name_EN);
					const fr = cleanName(e.name_FR);
					// Skip empty names to avoid false positives ("".includes("") is always true)
					return (
						(en.length > 0 && (en.includes(searchNameClean) || searchNameClean.includes(en))) ||
						(fr.length > 0 && (fr.includes(searchNameClean) || searchNameClean.includes(fr)))
					);
				});
			}

			if (found) {
				matchedEntry = found;
				_matchedFile = file;
				break;
			}
		}

		if (matchedEntry) {
			matches++;

			const sheetData = {
				matchedName: name,
				passiveEffect: passive,
				hissatsu: hissatsuName
					? {
							name: hissatsuName,
							type: hissatsuType,
							element: hissatsuElement,
							power: hissatsuPower,
						}
					: undefined,
				buff: buffEffect
					? {
							name: buffName,
							effect: buffEffect,
						}
					: undefined,
			};

			// Clean undefined
			if (!sheetData.hissatsu) delete sheetData.hissatsu;
			if (!sheetData.buff) delete sheetData.buff;

			matchedEntry.sheetData = sheetData;
			enrichedCount++;
			// console.log(`Matched "${name}" in ${matchedFile}`);
		} else {
			// console.log(`No match for "${name}"`);
		}
	}

	console.log(`Matched ${matches} sheet rows.`);
	console.log(`Enriched ${enrichedCount} entries.`);

	console.log("Saving enriched files...");
	for (const file of files) {
		if (entries[file].length > 0) {
			await fs.writeFile(path.join(ENTITIES_DIR, file), JSON.stringify(entries[file], null, 2));
		}
	}
	console.log("Done.");
}

matchHyperMoves().catch(console.error);
