import { readFileSync, writeFileSync } from "node:fs";

let c = readFileSync("Cargo.toml", "utf-8");

const additions = [
  'serde-wasm-bindgen = "0.6"',
  'js-sys = "0.3"',
  'wasm-bindgen = "0.2"',
  'web-sys = "0.3"',
];

for (const add of additions) {
  const key = add.split(" =")[0];
  if (!c.includes(`${key} =`)) {
    c = c.replace('[workspace.dependencies]', `[workspace.dependencies]\n${add}\n`);
  }
}

writeFileSync("Cargo.toml", c, "utf-8");
console.log("Patched Cargo.toml with wasm dependencies");
