import { readFileSync, writeFileSync } from "node:fs";

let c = readFileSync("Cargo.toml", "utf-8");
c = c.replace(/aphrody-gpu-backend\s*=\s*\{[^}]+\}/, 'aphrody-gpu-backend = { package = "shenron-gpu", path = "crates/shenron-gpu" }');
writeFileSync("Cargo.toml", c, "utf-8");
console.log("Pointed aphrody-gpu-backend to shenron-gpu");
