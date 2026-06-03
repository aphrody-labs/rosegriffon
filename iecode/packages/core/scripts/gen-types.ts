#!/usr/bin/env bun
/**
 * Génère les définitions TypeScript de IECODE.Core (et de ses deps référencées)
 * via le générateur node-api-dotnet, puis assainit la sortie : le générateur
 * émet des constructs C# avancés invalides en TS (noms compilateur `<X>`, byref
 * `Name&`, arité .NET `` `N ``). Idempotent.
 *
 * Usage : bun run gen:types   (après `bun run build:dotnet`)
 */
import { $ } from "bun";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../..");
const CORE = join(ROOT, "src/IECODE.Core/bin/Release/net10.0");
const GEN = join(ROOT, "vendor/node-api-dotnet/out/pkg/node-api-dotnet-generator/index.js");
const OUT = join(import.meta.dir, "../types");

if (!existsSync(GEN))
	throw new Error(`générateur absent : ${GEN} (faire 'dotnet pack' dans vendor/node-api-dotnet)`);
if (!existsSync(join(CORE, "IECODE.Core.dll")))
	throw new Error("IECODE.Core.dll absent (faire 'bun run build:dotnet')");

const refs = readdirSync(CORE)
	.filter((f) => f.endsWith(".dll"))
	.flatMap((f) => ["-r", join(CORE, f)]);

/** Rend valide le TS émis par le générateur (constructs C# non projetables). */
function sanitize(file: string): void {
	let s = readFileSync(file, "utf8");
	s = s.replace(/(^|[\s.(,:;{])<([A-Za-z0-9_]+)>/gm, "$1_$2_"); // noms compilateur <X> -> _X_
	s = s.replace(/`(\d+)/g, "$$$1"); // arité .NET `N -> $N
	s = s.replace(/([\w$)\]>])&(?!&)/g, "$1"); // byref Name& -> Name
	writeFileSync(file, s);
}

const done = new Set<string>();
const queue = ["IECODE.Core"];
while (queue.length > 0) {
	const name = queue.shift()!;
	if (done.has(name) || !existsSync(join(CORE, `${name}.dll`))) continue;
	done.add(name);
	const out = join(OUT, `${name}.d.ts`);
	await $`DOTNET_ROLL_FORWARD=LatestMajor bun ${GEN} -a ${join(CORE, `${name}.dll`)} -f net10.0 -p Microsoft.NETCore.App -p Microsoft.AspNetCore.App ${refs} -t ${out} --nowarn`.quiet();
	sanitize(out);
	// File d'attente : deps importées par le typedef généré.
	for (const m of readFileSync(out, "utf8").matchAll(/^import '\.\/([^']+)'/gm)) queue.push(m[1]!);
}
console.log(`typedefs générés + assainis (${done.size}) : ${[...done].join(", ")}`);
