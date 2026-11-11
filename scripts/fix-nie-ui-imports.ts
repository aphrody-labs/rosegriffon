import { resolve, relative, join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

const dir = "packages/nie-ui/tools/pixel-perfect/validation";
const files = [
  "menu-animation-wasm-equality.mjs",
  "menu-scene-wasm-equality.mjs",
  "native-presentation-wasm-equality.mjs",
];

const target = resolve("packages/nie-web/src/nie-wasm-web/nie_wasm.js");

for (const f of files) {
  const filePath = join(dir, f);
  let content = readFileSync(filePath, "utf8");
  const rel = relative(dir, target).replace(/\\/g, "/");
  console.log(f, "calculated relative path:", rel);
  content = content.replace(/from\s+["'].*?nie_wasm\.js["']/g, `from "${rel}"`);
  writeFileSync(filePath, content);
}
