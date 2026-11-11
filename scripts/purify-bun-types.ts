import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";

function glob(dir: string): string[] {
  const res: string[] = [];
  try {
    for (const f of readdirSync(dir)) {
      const full = `${dir}/${f}`;
      if (statSync(full).isDirectory()) {
        if (!full.includes("node_modules") && !full.includes(".git") && !full.includes(".next")) {
          res.push(...glob(full));
        }
      } else {
        if (f === "package.json") res.push(full);
      }
    }
  } catch {}
  return res;
}

const pkgs = glob(".");
console.log(`Found package.json files: ${pkgs.length}`);
let count = 0;
for (const p of pkgs) {
  let txt = readFileSync(p, "utf8");
  if (txt.includes("npm:@aphrody/bun-types")) {
    txt = txt.replace(/npm:@aphrody\/bun-types@1\.4\.4-aphrody\.[0-9]+/g, "1.4.4");
    txt = txt.replace(/"@types\/bun":\s*"npm:@aphrody\/bun-types[^"]+"/g, '"@types/bun": "catalog:"');
    writeFileSync(p, txt);
    count++;
    console.log(`Purified ${p}`);
  }
}
console.log(`Purified total: ${count}`);
