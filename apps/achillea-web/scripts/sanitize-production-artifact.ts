#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";

const artifactRoot = resolve(import.meta.dir, "../dist/achillea-web/browser");
const textExtensions = new Set([
	".css",
	".html",
	".js",
	".json",
	".svg",
	".txt",
	".webmanifest",
	".xml",
]);
const ipLiteral =
	/(?<![A-Za-z0-9])(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?![A-Za-z0-9])/;
const forbiddenHost = /localhost|\[::1\]/i;
const secretSignatures: Array<[string, RegExp]> = [
	["private-key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
	["aws-access-key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
	["github-token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
	["slack-token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
	["stripe-secret", /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/],
	["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/],
	["jwt", /\beyJ[A-Za-z0-9_-]{16,}\.eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/],
	[
		"credential-url",
		/\b(?:postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?):\/\/[^\s/]+:[^\s@]{4,}@/i,
	],
	["supabase-secret", /\bsb_(?:secret|service_role)_[A-Za-z0-9_-]+\b/],
	[
		"discord-bot-token",
		/\b(?:M|N|O)[A-Za-z0-9_-]{20,30}\.[A-Za-z0-9_-]{5,10}\.[A-Za-z0-9_-]{20,50}\b/,
	],
];

async function files(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const path = resolve(directory, entry.name);
			return entry.isDirectory() ? files(path) : Promise.resolve([path]);
		})
	);
	return nested.flat();
}

let sanitizedFiles = 0;
const artifactFiles = await files(artifactRoot);
for (const path of artifactFiles) {
	if (!textExtensions.has(extname(path))) continue;
	let content = await Bun.file(path).text();
	const sanitized = content
		.replaceAll(/localhost/gi, "invalid.invalid")
		.replaceAll("127.0.0.1", "invalid.invalid")
		.replaceAll("0.0.0.0", "invalid.invalid")
		.replaceAll("[::1]", "invalid.invalid");
	if (sanitized !== content) {
		await Bun.write(path, sanitized);
		content = sanitized;
		sanitizedFiles++;
	}

	if (forbiddenHost.test(content) || ipLiteral.test(content)) {
		throw new Error(`production artifact contains a forbidden host literal: ${path}`);
	}
	for (const [name, signature] of secretSignatures) {
		if (signature.test(content)) throw new Error(`production artifact matches ${name}: ${path}`);
	}
}

console.log(
	`[artifact] verified ${artifactFiles.length} files; normalized ${sanitizedFiles} dependency fallback file(s)`
);
