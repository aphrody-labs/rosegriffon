import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const cratesDir = join(process.cwd(), "crates");
const cargoTomlPath = join(process.cwd(), "Cargo.toml");

const dirs = readdirSync(cratesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(cratesDir, d.name, "Cargo.toml")))
  .map((d) => `crates/${d.name}`)
  .sort();

console.log(`Discovered ${dirs.length} crates with Cargo.toml in crates/`);

let cargoToml = readFileSync(cargoTomlPath, "utf-8");

// Replace members = [ ... ]
const membersList = dirs.map((d) => `    "${d}",`).join("\n");
const newMembers = `members = [\n${membersList}\n]`;

cargoToml = cargoToml.replace(/members\s*=\s*\[[\s\S]*?\]/, newMembers);

writeFileSync(cargoTomlPath, cargoToml, "utf-8");
console.log("Updated Cargo.toml members successfully!");
