import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = import.meta.dir;
const DATA_DIR = path.join(__dirname, "../data");
const ENTITIES_DIR = path.join(__dirname, "../entries");

interface TeamEntry {
	teamId: string;
	names?: { en?: string; fr?: string; ja?: string };
	sheetData?: any;
	[key: string]: any;
}

async function matchTeams() {
	console.log("Loading Sheet Data...");
	const sheetContent = await fs.promises.readFile(
		path.join(DATA_DIR, "sheet_export.json"),
		"utf-8"
	);
	const sheetJson = JSON.parse(sheetContent);
	const sheet = sheetJson.sheets["Free Match Drops"];

	if (!sheet) {
		console.error("Free Match Drops sheet not found");
		return;
	}

	// Headers at row 1. Data starts row 2.
	const dataRows = sheet.slice(2);

	console.log("Loading Teams Entry...");
	const teamsPath = path.join(ENTITIES_DIR, "teams.json");
	if (!(await Bun.file(teamsPath).exists())) {
		console.error("teams.json not found");
		return;
	}
	const teams: TeamEntry[] = JSON.parse(await fs.promises.readFile(teamsPath, "utf-8"));

	let matches = 0;

	const cleanName = (str: string | undefined) => {
		if (!str) return "";
		return str.toLowerCase().replace(/[^a-z0-9]/g, "");
	};

	let currentTeamName = "";
	let currentTeamData: any = null;

	for (const row of dataRows) {
		if (!row || row.length < 5) continue;

		const teamName = row[1];
		if (teamName?.trim()) {
			currentTeamName = teamName.trim();
			currentTeamData = {
				matchedName: currentTeamName,
				game: row[2],
				fixedBeans: row[3],
				passives: [],
			};

			// Find matching teams in entry
			const searchName = cleanName(currentTeamName);
			const foundTeams = teams.filter((t) => {
				const en = cleanName(t.name_EN || t.name);
				// Also check if entry name contains sheet name or vice versa (fuzzy)
				return (
					en === searchName ||
					(en.length > 3 && (en.includes(searchName) || searchName.includes(en)))
				);
			});

			if (foundTeams.length > 0) {
				matches += foundTeams.length;
				for (const t of foundTeams) {
					t.sheetData = currentTeamData;
				}
			}
		}

		// Add passive to current team (even if row teamName is empty, it belongs to previous team)
		if (currentTeamData && row[6] && row[7]) {
			currentTeamData.passives.push({
				requirement: row[6],
				stat: row[7],
				value: row[8],
			});
		}
	}

	console.log(`Matched ${matches} team entries.`);
	console.log("Saving teams.json...");
	await fs.promises.writeFile(teamsPath, JSON.stringify(teams, null, 2));
	console.log("Done.");
}

matchTeams().catch(console.error);
