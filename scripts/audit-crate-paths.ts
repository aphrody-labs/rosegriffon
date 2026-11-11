import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const cratesDir = join(process.cwd(), "crates");
const manifests = readdirSync(cratesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(cratesDir, d.name, "Cargo.toml")))
  .map((d) => join(cratesDir, d.name, "Cargo.toml"));

const externalDeps = new Map<string, string[]>();

for (const m of manifests) {
  const content = readFileSync(m, "utf-8");
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.includes("path =") && (line.includes("../..") || line.includes("yolo-ai") || line.includes("yolo-os"))) {
      const match = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
      const depName = match ? match[1] : line.trim();
      if (!externalDeps.has(depName)) {
        externalDeps.set(depName, []);
      }
      externalDeps.get(depName)!.push(`${m}: ${line.trim()}`);
    }
  }
}

for (const [dep, occurrences] of externalDeps.entries()) {
  console.log(`\nExternal dependency: ${dep} (${occurrences.length} occurrences)`);
  for (const occ of occurrences.slice(0, 3)) {
    console.log(`  ${occ}`);
  }
}
