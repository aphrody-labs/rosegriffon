import fs from "node:fs";

let toml = fs.readFileSync("Cargo.toml", "utf8");
const lines = toml.split("\n");
const newLines = lines.map(line => {
  if (line.includes("https://github.com/aphrody-labs/") && !line.trim().startsWith("#")) {
    return "# " + line;
  }
  return line;
});
fs.writeFileSync("Cargo.toml", newLines.join("\n"));
console.log("Disabled unreachable aphrody-labs git patches");
