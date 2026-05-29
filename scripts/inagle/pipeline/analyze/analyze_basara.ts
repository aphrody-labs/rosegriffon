import * as fs from "node:fs";
import * as path from "node:path";

const INPUT_FILE = path.resolve(__dirname, "../data/sheet_export.json");

async function analyzeBasara() {
	try {
		const rawData = await Bun.file(INPUT_FILE).text();
		const fullSheetData = JSON.parse(rawData);
		const sheets = fullSheetData.sheets;

		const basaraSheets = ["Basara", "ALL Basara"];

		for (const sheetName of basaraSheets) {
			if (!sheets[sheetName]) {
				console.log(`Sheet '${sheetName}' not found.`);
				continue;
			}

			const rows = sheets[sheetName];
			console.log(`
=== Analyzing Sheet: ${sheetName} ===`);
			console.log(`Total Rows: ${rows.length}`);

			if (rows.length > 0) {
				console.log("Headers:", JSON.stringify(rows[0]));

				// Analyze column density (how many non-empty values per column)
				const headers = rows[0];
				const colStats = headers.map(() => ({ count: 0, distinct: new Set() }));

				// Check first 100 rows for detailed sample
				const _limit = Math.min(rows.length, 100);
				for (let i = 1; i < rows.length; i++) {
					const row = rows[i];
					row.forEach((cell: any, index: number) => {
						if (cell !== "" && cell !== null && cell !== undefined) {
							if (colStats[index]) {
								colStats[index].count++;
								if (colStats[index].distinct.size < 10) {
									// Keep set small for memory
									colStats[index].distinct.add(cell);
								}
							}
						}
					});
				}

				console.log("\nColumn Analysis (Non-empty count / Total rows):");
				headers.forEach((h: string, i: number) => {
					const stats = colStats[i];
					const sample = Array.from(stats?.distinct || []).join(", ");
					console.log(
						`[${i}] ${h || "UNKNOWN"}: ${stats?.count}/${rows.length - 1} filled. Sample: ${sample}`
					);
				});

				console.log("\nSample Rows (1-3):");
				console.log(JSON.stringify(rows[1]));
				console.log(JSON.stringify(rows[2]));
				console.log(JSON.stringify(rows[3]));
			}
		}
	} catch (error) {
		console.error("Error:", error);
	}
}

analyzeBasara();
