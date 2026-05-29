import "dotenv/config";

console.log("CWD:", process.cwd());
console.log("DATA_PATH from env:", process.env.DATA_PATH);

import { DATA_ROOT, PATHS } from "@rose-griffon/inagle/core/paths.ts";

console.log("Resolved DATA_ROOT:", DATA_ROOT);
console.log("Resolved PATHS.root:", PATHS.root);
