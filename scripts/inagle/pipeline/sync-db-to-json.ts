import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import dotenv from "dotenv";

const root = resolve(import.meta.dir, "../../..");
dotenv.config({ path: resolve(root, ".env.local") });

async function syncDbToJson() {
	const dbUrl = process.env.DATABASE_URL;
	if (!dbUrl) {
		console.error("❌ DATABASE_URL not found in environment.");
		process.exit(1);
	}

	const pool = new pg.Pool({ connectionString: dbUrl });
	console.log("🔄 Fetching series corrections from local DB...");
	
	try {
		const { rows: dbChars } = await pool.query<{
			id: string;
			series: string | null;
		}>("SELECT id, series FROM inagle_characters WHERE series IS NOT NULL");
		
		console.log(`  Found ${dbChars.length} characters in DB.`);

		const dbSeriesMap = new Map<string, string>();
		for (const r of dbChars) {
			if (r.series) dbSeriesMap.set(r.id.toLowerCase().trim(), r.series);
		}

		const jsonPath = resolve(root, "packages/inagle/src/entries/characters.json");
		console.log(`📖 Reading source JSON: ${jsonPath}`);
		const rawJson = readFileSync(jsonPath, "utf-8");
		const characters = JSON.parse(rawJson);

		let updateCount = 0;
		for (const char of characters) {
			if (!char.charaParamId) continue;
			const key = char.charaParamId.toLowerCase().trim();
			const dbSeries = dbSeriesMap.get(key);
			if (dbSeries && char.series !== dbSeries) {
				console.log(`  ✏️ Updating "${char.names?.fr || char.slug}": "${char.series}" ➔ "${dbSeries}"`);
				char.series = dbSeries;
				updateCount++;
			}
		}

		if (updateCount > 0) {
			console.log(`💾 Writing ${updateCount} updates to characters.json...`);
			writeFileSync(jsonPath, JSON.stringify(characters, null, 2), "utf-8");
			console.log("✅ Source characters.json successfully synchronized!");
		} else {
			console.log("✨ No changes to synchronize (source JSON matches DB).");
		}
	} catch (e) {
		console.error("❌ Sync failed:", e);
	} finally {
		await pool.end();
	}
}

syncDbToJson().catch(console.error);
