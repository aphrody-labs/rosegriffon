import { existsSync, readdirSync, readFileSync } from "node:fs";

console.log("C:/src exists:", existsSync("C:/src"));
if (existsSync("C:/src")) {
  console.log("C:/src contents:", readdirSync("C:/src"));
}

console.log("yolo-re crates:", readdirSync("C:/Users/aphro/.gemini/antigravity-cli/brain/08cca5b6-0b93-4b42-9819-645b55538917/scratch/repos/yolo-re/crates").filter(c => c.includes("sprite")));
