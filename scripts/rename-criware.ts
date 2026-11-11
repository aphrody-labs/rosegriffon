import { readFileSync, writeFileSync } from "node:fs";

let c = readFileSync("crates/criware/Cargo.toml", "utf-8");
c = c.replace(/name\s*=\s*"aphrody-nie-formats"/, 'name = "criware"');
c = c.replace(/description\s*=\s*"[^"]*"/, 'description = "Canonical unified CRIWARE CPK, CRILAYLA, ACB, AWB, HCA, ADX, USM parser and encoder"');

writeFileSync("crates/criware/Cargo.toml", c, "utf-8");
console.log("Renamed criware crate package name to criware");
