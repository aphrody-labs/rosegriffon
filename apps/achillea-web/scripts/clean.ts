import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dir, "..");

for (const name of ["dist", ".angular"]) {
	const target = resolve(appRoot, name);
	if (!target.startsWith(`${appRoot}/`)) {
		throw new Error(`Refusing to clean outside the application: ${target}`);
	}
	await rm(target, { force: true, recursive: true });
}
