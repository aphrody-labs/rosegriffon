#!/usr/bin/env bun
// publish-npm.ts — publie les packages rg sur npmjs PUBLIC sous le scope @rosegriffon
// (l'org npm est `rosegriffon`, sans tiret ; le monorepo reste `@rose-griffon` côté source).
// Méthode NON-destructive : staging temp + réécriture du scope (nom + deps) + `bun publish`.
// Ordre topologique des deps internes. Idempotent (409 = déjà publié → skip).
// Usage : bun tools/publish-npm.ts [pkg...]   (défaut = tous, en ordre topo)

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const RG = "/home/ubuntu/rg";
const SRC = "@rose-griffon";
const DST = "@rosegriffon";
// Exclus : `inagle` (existe en 2.0.1 + données RE sous copyright LEVEL-5) et `cron`
// (task-runner couplé IEVR, dépend de inagle — pas une lib publique réutilisable).
const ORDER = ["config", "assets", "patreon-bun", "types", "db", "auth", "ui"];

// Catalog Bun racine (workspaces.catalog) — pour résoudre les deps `catalog:`.
const ROOT = JSON.parse(readFileSync(`${RG}/package.json`, "utf8"));
const CATALOG: Record<string, string> = ROOT.workspaces?.catalog ?? ROOT.catalog ?? {};

const want = process.argv.slice(2);
const list = want.length > 0 ? ORDER.filter((p) => want.includes(p)) : ORDER;

// Carte version (pour réécrire workspace:* -> ^version).
const vmap: Record<string, string> = {};
for (const p of ORDER) {
	const pj = JSON.parse(readFileSync(`${RG}/packages/${p}/package.json`, "utf8"));
	vmap[pj.name] = pj.version;
}
const rwName = (n: string): string =>
	n.startsWith(`${SRC}/`) ? `${DST}/${n.slice(SRC.length + 1)}` : n;
const rwDeps = (deps?: Record<string, string>): Record<string, string> | undefined => {
	if (!deps) {
		return deps;
	}
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(deps)) {
		if (k.startsWith(`${SRC}/`)) {
			const ver = vmap[k];
			out[rwName(k)] = ver ? `^${ver}` : v;
		} else if (v === "catalog:" || v.startsWith("catalog:")) {
			// Résout la dep `catalog:` vers la version réelle du catalog racine.
			out[k] = CATALOG[k] ?? "*";
		} else {
			out[k] = v;
		}
	}
	return out;
};

const results: string[] = [];
for (const p of list) {
	const src = `${RG}/packages/${p}`;
	const tmp = `/tmp/pub/${p}`;
	rmSync(tmp, { recursive: true, force: true });
	mkdirSync(tmp, { recursive: true });
	cpSync(src, tmp, {
		recursive: true,
		filter: (s) => !/node_modules|\.git|\.env|\.turbo|tsbuildinfo|\/dist\//.test(s),
	});
	const pj = JSON.parse(readFileSync(`${tmp}/package.json`, "utf8"));
	pj.name = rwName(pj.name);
	pj.dependencies = rwDeps(pj.dependencies);
	pj.devDependencies = rwDeps(pj.devDependencies);
	pj.peerDependencies = rwDeps(pj.peerDependencies);
	// Strip les scripts de lifecycle (build/prepublishOnly/prepare/postinstall) : ils échouent
	// hors contexte workspace et ne sont pas nécessaires (on publie la source telle quelle).
	pj.scripts = undefined;
	pj.publishConfig = { registry: "https://registry.npmjs.org/", access: "public" };
	pj.repository = {
		type: "git",
		url: "git+https://github.com/rose-griffon/rg.git",
		directory: `packages/${p}`,
	};
	pj.private = undefined;
	writeFileSync(`${tmp}/package.json`, `${JSON.stringify(pj, null, 2)}\n`);
	if (!existsSync(`${tmp}/README.md`)) {
		writeFileSync(
			`${tmp}/README.md`,
			`# ${pj.name}\n\n${pj.description ?? "Package du monorepo rose-griffon."}\n\nPublié publiquement sur npm. Source : github.com/rose-griffon/rg (\`packages/${p}\`).\n`,
		);
	}
	try {
		execSync(`cd ${tmp} && bun publish --access public 2>&1`, { encoding: "utf8" });
		results.push(`OK   ${pj.name}@${pj.version}`);
	} catch (e: unknown) {
		const msg = String((e as { stdout?: string }).stdout ?? (e as Error).message ?? "");
		const dup = /409|cannot publish over|previously published/i.test(msg);
		results.push(
			dup
				? `SKIP ${pj.name} (version déjà publiée)`
				: `FAIL ${pj.name}: ${msg.split("\n").filter(Boolean).slice(-2).join(" | ")}`,
		);
	}
}
console.log(results.join("\n"));
