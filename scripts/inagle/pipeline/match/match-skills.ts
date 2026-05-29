import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = import.meta.dir;
const DATA_DIR = path.join(__dirname, "../data");
const ENTITIES_DIR = path.join(__dirname, "../entries");

interface SkillEntry {
	skillID: string;
	skillIDStr: string;
	displayName: string;
	name_EN?: string;
	name_FR?: string;
	sheetData?: any;
	[key: string]: any;
}

async function matchSkills() {
	console.log("Loading Sheet Data...");
	const sheetContent = await fs.promises.readFile(
		path.join(DATA_DIR, "sheet_export.json"),
		"utf-8"
	);
	const sheetJson = JSON.parse(sheetContent);

	const hissatsuRows = sheetJson.sheets.Hissatsu;
	const tacticsRows = sheetJson.sheets.Tactics;

	console.log("Loading Skills Entry...");
	const skillsPath = path.join(ENTITIES_DIR, "skills.json");
	if (!(await Bun.file(skillsPath).exists())) {
		console.error("skills.json not found");
		return;
	}
	const skills: SkillEntry[] = JSON.parse(await fs.promises.readFile(skillsPath, "utf-8"));

	let matches = 0;

	const cleanName = (str: string | undefined) => {
		if (!str) return "";
		return str.toLowerCase().replace(/[^a-z0-9]/g, "");
	};

	// Spelling fixes: sheet name -> DB name (cleanName form)
	const SHEET_NAME_ALIASES: Record<string, string> = {
		[cleanName("Mermaid Veil")]: cleanName("Mermaid's Veil"),
		[cleanName("Judgement Ray")]: cleanName("Judgment Ray"),
		[cleanName("Burnout Blast")]: cleanName("Burnout Burst"),
		[cleanName("Zipzag Spark")]: cleanName("Zigzag Spark"),
	};

	const resolveSheetName = (name: string) => {
		const cn = cleanName(name);
		return SHEET_NAME_ALIASES[cn] || cn;
	};

	// 1. Process Hissatsu
	if (hissatsuRows) {
		console.log("Processing Hissatsu sheet...");
		const dataRows = hissatsuRows.slice(1);
		for (const row of dataRows) {
			const name = row[1];
			if (!name?.trim()) continue;

			const searchName = resolveSheetName(name);
			const found = skills.find(
				(s) => cleanName(s.name_EN) === searchName || cleanName(s.name_FR) === searchName
			);

			if (found) {
				matches++;
				found.sheetData = {
					matchedName: name,
					power: row[4],
					tension: row[5],
					type: row[6],
					subType: row[7],
					shop: row[8],
					duration: row[10],
				};
			}
		}
	}

	// 2. Process Tactics
	if (tacticsRows) {
		console.log("Processing Tactics sheet...");
		const dataRows = tacticsRows.slice(1);
		for (const row of dataRows) {
			const name = row[0];
			if (!name?.trim()) continue;

			const searchName = resolveSheetName(name);
			const found = skills.find(
				(s) => cleanName(s.name_EN) === searchName || cleanName(s.name_FR) === searchName
			);

			if (found) {
				matches++;
				found.sheetData = {
					matchedName: name,
					effects: [row[1], row[2], row[3]].filter(Boolean),
					duration: row[4],
					cooldown: row[5],
					shop: row[6],
				};
			}
		}
	}

	console.log(`Matched ${matches} skills.`);
	console.log("Saving skills.json...");
	await fs.promises.writeFile(skillsPath, JSON.stringify(skills, null, 2));
	console.log("Done.");
}

matchSkills().catch(console.error);
