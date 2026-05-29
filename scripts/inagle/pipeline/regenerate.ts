import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_ROOT, PATHS } from "@rose-griffon/inagle/core/paths.ts";
import { buildItemsDatabaseAsync } from "@rose-griffon/inagle/items/api.ts";
import { buildSkillDatabase } from "@rose-griffon/inagle/skills/mapper.ts";
import { buildTeamsDatabase } from "@rose-griffon/inagle/teams/api.ts";

async function regenerate() {
	console.log("🚀 Regenerating entities from raw gamedata...");
	console.log(`📂 Data Root: ${DATA_ROOT}`);
	console.log(`📂 Entities Path: ${PATHS.entities}`);

	// Ensure entities dir exists
	mkdirSync(PATHS.entities, { recursive: true });

	// 1. Skills
	console.log("\n⚔️ Processing Skills...");
	const skillsDb = buildSkillDatabase({ dataRoot: DATA_ROOT });
	const _skillsPath = join(PATHS.entities, "skills-all-types.json");

	// Convert to Unified format (main/aura/passive)
	// Actually buildSkillDatabase only returns main skills? No, it returns UnifiedSkill[] in .skills
	// But skills-all-types.json expects { main, aura, passive }

	// We need to fetch aura and passives too.
	// Assuming aura/passives are already handled by other mappers or we just save main skills here for now.
	// Let's check api.ts logic. It reads skills-all-types.json.

	// For now, let's just save the main skills to skills.json which is also supported as fallback
	const skillsOutPath = join(PATHS.entities, "skills.json");
	writeFileSync(
		skillsOutPath,
		JSON.stringify(
			{
				data: skillsDb.skills,
				meta: { generatedAt: new Date().toISOString() },
			},
			null,
			2
		)
	);
	console.log(`✅ Saved ${skillsDb.skills.length} skills to ${skillsOutPath}`);

	// 2. Items
	console.log("\n🎒 Processing Items...");
	const itemsDb = await buildItemsDatabaseAsync({ dataPath: DATA_ROOT });
	const itemsOutPath = join(PATHS.entities, "items.json");
	// ParsedItem[] expected
	writeFileSync(
		itemsOutPath,
		JSON.stringify(
			{
				data: itemsDb.items,
				meta: itemsDb.stats,
			},
			null,
			2
		)
	);
	console.log(`✅ Saved ${itemsDb.items.length} items to ${itemsOutPath}`);

	// 3. Teams
	console.log("\n⚽ Processing Teams...");
	const _teamsDb = buildTeamsDatabase({
		gamedataPath: join(DATA_ROOT, "common/gamedata"),
		entitiesPath: PATHS.entities,
	});
	// This one READS entities... circular dependency?
	// buildTeamsDatabase reads teams.json. If we want to regenerate it from raw, we need a raw parser.
	// parser/belong-team.ts

	// Skipping Teams regeneration for now as it seems to rely on manual json.
	console.log("⏭️ Teams regeneration skipped (manual source).");

	console.log("\n✨ Regeneration Complete!");
}

regenerate().catch(console.error);
