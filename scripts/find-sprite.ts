import { readdirSync, existsSync } from "node:fs";

for (const base of ["C:/src/crates", "C:/src/apps", "C:/src/packages", "C:/Users/aphro/.gemini/antigravity-cli/brain/08cca5b6-0b93-4b42-9819-645b55538917/scratch/repos/yolo-re/crates"]) {
  if (existsSync(base)) {
    const matches = readdirSync(base).filter(f => f.toLowerCase().includes("sprite") || f.toLowerCase().includes("softraster"));
    console.log(`${base}:`, matches);
  }
}
