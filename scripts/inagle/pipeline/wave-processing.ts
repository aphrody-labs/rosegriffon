import { spawn } from "bun";
import { resolve } from "node:path";
import { writeFileSync, existsSync } from "node:fs";

async function runScript(path: string, args: string[] = []) {
	console.log(`\n======================================================`);
	console.log(`🚀 Running script: ${path} ${args.join(" ")}`);
	console.log(`======================================================`);
	const proc = spawn(["bun", path, ...args], {
		stdout: "inherit",
		stderr: "inherit",
	});
	const status = await proc.exited;
	if (status !== 0) {
		console.error(`❌ Script ${path} exited with status ${status}`);
		return false;
	} else {
		console.log(`✅ Script ${path} finished successfully.`);
		return true;
	}
}

async function main() {
	const root = resolve(import.meta.dir, "../../..");
	
	console.log("🌊 Starting Data Processing and Enrichment Wave...");
	
	// 1. Audit Zukan matches (order, position, element alignment checks)
	const zukanOk = await runScript(resolve(root, "scripts/inagle/pipeline/audit-zukan-matches.ts"));
	
	// 2. Audit Series and fix them in the local DB
	const seriesOk = await runScript(resolve(root, "scripts/inagle/pipeline/audit-series.ts"), ["--db"]);
	
	// 3. Generate Multilingual Glossary
	const glossaryOk = await runScript(resolve(root, "scripts/inagle/pipeline/generate-glossary.ts"));
	
	// 4. Build asset cross-reference definitions
	const assetOk = await runScript(resolve(root, "scripts/inagle/pipeline/build-asset-cross-reference.ts"));
	
	console.log("\n======================================================");
	console.log("🎉 WAVE COMPLETED!");
	console.log(`Results:`);
	console.log(`  - Zukan Matches Audit: ${zukanOk ? "SUCCESS" : "FAILED"}`);
	console.log(`  - Series DB Align & Audit: ${seriesOk ? "SUCCESS" : "FAILED"}`);
	console.log(`  - Glossary Generation: ${glossaryOk ? "SUCCESS" : "FAILED"}`);
	console.log(`  - Asset Cross-Reference: ${assetOk ? "SUCCESS" : "FAILED"}`);
	console.log("======================================================\n");
}

main().catch(console.error);
