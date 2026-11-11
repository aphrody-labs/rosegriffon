import { readFileSync, writeFileSync } from "node:fs";

let c = readFileSync("Cargo.toml", "utf-8");
const lines = c.split("\n");
const seen = new Set<string>();
const out: string[] = [];

let inDeps = false;
for (const line of lines) {
  if (line.trim().startsWith("[workspace.dependencies]")) {
    inDeps = true;
    out.push(line);
    continue;
  }
  if (inDeps && line.trim().startsWith("[")) {
    inDeps = false;
    out.push(line);
    continue;
  }
  if (inDeps) {
    const match = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
    if (match) {
      const key = match[1];
      if (seen.has(key)) {
        continue; // drop duplicate
      }
      seen.add(key);
    }
  }
  out.push(line);
}

writeFileSync("Cargo.toml", out.join("\n"), "utf-8");
console.log("Deduplicated Cargo.toml dependencies");
