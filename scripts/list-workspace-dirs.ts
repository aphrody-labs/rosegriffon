import { readdirSync } from "node:fs";

console.log("packages:", readdirSync("packages"));
console.log("apps:", readdirSync("apps"));
console.log("crates count:", readdirSync("crates").length);
