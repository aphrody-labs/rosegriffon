import { readFileSync, writeFileSync } from "node:fs";

let src = readFileSync("packages/rg-app-shell/src/lib/translations.ts", "utf8");
if (!src.includes('"nav.play"')) {
  src = src.replace(
    '"nav.cross": "Inazuma Eleven Cross",',
    '"nav.play": "Jouer à IEVR",\n  "nav.cross": "Inazuma Eleven Cross",'
  );
  writeFileSync("packages/rg-app-shell/src/lib/translations.ts", src);
  console.log("Added nav.play to translations.ts");
}
