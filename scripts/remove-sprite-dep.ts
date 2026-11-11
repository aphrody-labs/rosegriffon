import { readFileSync, writeFileSync } from "node:fs";

for (const path of ["crates/aphrody-nie-formats/Cargo.toml", "crates/criware/Cargo.toml"]) {
  let c = readFileSync(path, "utf-8");
  c = c.replace(/aphrody-sprite-sheet\s*=\s*\{[^}]+\}\r?\n/g, "");
  writeFileSync(path, c, "utf-8");
}
console.log("Removed aphrody-sprite-sheet dep from Cargo.tomls");
