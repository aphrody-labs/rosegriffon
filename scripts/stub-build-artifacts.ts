import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const files = [
  "packages/nie-web/src/wasm/nie_wasm.js",
  "crates/aphrody-nie-lua-web/js/aphrody-nie-lua-web.ts"
];

for (const f of files) {
  if (!existsSync(f)) {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, "export default {};\nexport const init = async () => {};\n", "utf-8");
    console.log("Created stub for build artifact:", f);
  }
}
