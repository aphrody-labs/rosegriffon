import { createSupabaseServiceClient } from "@rose-griffon/db/service";
import * as fs from "node:fs";
import * as path from "node:path";

async function run() {
	const supabase = createSupabaseServiceClient();
	
	// Fetch all characters using range to bypass the 1000 rows limit
	const allCharacters: any[] = [];
	let from = 0;
	let to = 999;
	let hasMore = true;

	while (hasMore) {
		const { data, error } = await supabase
			.from("inagle_characters")
			.select("id, name_fr, internal_code")
			.range(from, to);

		if (error) {
			console.error("Error fetching characters:", error);
			return;
		}

		if (data && data.length > 0) {
			allCharacters.push(...data);
			from += 1000;
			to += 1000;
		} else {
			hasMore = false;
		}
	}

	const baseDir = "/home/ubuntu/.local/share/Steam/steamcmd/inazuma/data/dx11/menu/icon_chr/face";
	let total = 0;
	let missing = 0;
	const missingList: Array<{ id: string; name: string; code: string; expectedPath: string }> = [];

	for (const char of allCharacters) {
		if (!char.internal_code) continue;
		total++;
		const baseCode = char.internal_code.replace(/_\d{4}$/, "");
		const filename = `${baseCode}_l_${baseCode}_1_l00.png`;
		const fullPath = path.join(baseDir, filename);

		if (!fs.existsSync(fullPath)) {
			missing++;
			if (missingList.length < 50) {
				missingList.push({
					id: char.id,
					name: char.name_fr || "Inconnu",
					code: char.internal_code,
					expectedPath: filename,
				});
			}
		}
	}

	console.log(`Face asset check (all characters):`);
	console.log(`- Checked: ${total} characters`);
	console.log(`- Missing on disk: ${missing} (${((missing / total) * 100).toFixed(1)}%)`);
	if (missing > 0) {
		console.log(`Sample missing characters (first 50):`);
		console.log(missingList);
	}
}

run().catch(console.error);
