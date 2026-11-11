import { readFileSync, writeFileSync } from "node:fs";

let c = readFileSync("Cargo.toml", "utf-8");

if (!c.includes('vello = "0.11.0"')) {
  c = c.replace('[workspace.dependencies]', '[workspace.dependencies]\nvello = "0.11.0"\n');
  writeFileSync("Cargo.toml", c, "utf-8");
  console.log("Added vello to Cargo.toml workspace.dependencies");
}
