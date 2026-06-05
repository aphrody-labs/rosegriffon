#!/usr/bin/env bun
/**
 * Génère `data/item-image-manifest.json` : mapping `internal_code → path/filename`
 * (relatif à `cdn.rosegriffon.fr/dx11/menu/`) pour les items dont l'`image_url` DB
 * ne pointe pas vers un fichier réel.
 *
 * Stratégie de match (ordonnée) :
 *   1. Path DB `image_url` directement (extension swap webp→png).
 *   2. Item dossier : `200_icon/02_icon_item/{*}_{internal_code}.png` ou `{internal_code}.png`.
 *   3. Skill telop : `220_img/telop_waza/fr|en/{internal_code}_{internal_code}.png` (cas des
 *      items qui partagent le code avec un skill, ex: `wao00930`, `who00150`).
 *
 * Le manifest stocke un path relatif depuis `dx11/menu/` (ex: `200_icon/02_icon_item/icon_item10_tk_hr000007`).
 * Run : `bun scripts/build-item-image-manifest.ts`
 */
const MENU_ROOT =
	process.env.IEVR_MENU_ROOT ??
	`${process.env.DATA_PATH ?? "/home/ubuntu/niers/data"}/dx11/menu`;

const SCAN_DIRS = ["200_icon/02_icon_item", "220_img/telop_waza/fr", "220_img/telop_waza/en"];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
	console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
	process.exit(1);
}

// Index : { filename → relative path under menu/ } pour chaque scan dir.
// Plusieurs dirs peuvent contenir le même filename → priorité à l'ordre de SCAN_DIRS.
const fileIndex = new Map<string, string>();
const dirIndexes: Record<string, Set<string>> = {};

for (const dir of SCAN_DIRS) {
	const set = new Set<string>();
	try {
		const glob = new Bun.Glob("*.png");
		for await (const f of glob.scan({ cwd: `${MENU_ROOT}/${dir}` })) {
			set.add(f);
			if (!fileIndex.has(f)) {
				fileIndex.set(f, `${dir}/${f}`);
			}
		}
	} catch {
		console.warn(`Skip missing dir: ${dir}`);
	}
	dirIndexes[dir] = set;
	console.log(`Scanned ${dir}: ${set.size} files`);
}
console.log(`Total unique filenames: ${fileIndex.size}`);

// Pagination Supabase.
const items: Array<{ internal_code: string | null; image_url: string | null }> = [];
const PAGE = 1000;
for (let offset = 0; ; offset += PAGE) {
	const r = await fetch(
		`${SUPABASE_URL}/rest/v1/inagle_items?select=internal_code,image_url&limit=${PAGE}&offset=${offset}`,
		{
			headers: {
				Authorization: `Bearer ${SUPABASE_KEY}`,
				apikey: SUPABASE_KEY,
			},
		}
	);
	if (!r.ok) {
		console.error(`Supabase fetch failed: ${r.status} ${await r.text()}`);
		process.exit(1);
	}
	const page: typeof items = await r.json();
	items.push(...page);
	if (page.length < PAGE) {
		break;
	}
}
console.log(`DB items: ${items.length}`);

const manifest: Record<string, string> = {};
let viaDirect = 0;
let viaInternalCode = 0;
let viaSkillTelop = 0;
let unresolved = 0;
const unresolvedSamples: string[] = [];

for (const it of items) {
	const code = it.internal_code;
	if (!code) {
		continue;
	}

	// 1. DB image_url direct match.
	if (it.image_url) {
		const dbFilename = it.image_url.replace(/^.*\//, "").replace(/\.webp$/, ".png");
		// Tente toutes les dirs scannées dans l'ordre.
		const matchedDir = SCAN_DIRS.find((d) => dirIndexes[d]?.has(dbFilename));
		if (matchedDir) {
			// Si c'est dans 02_icon_item ET le filename matche le default (pas besoin de manifest), skip.
			const defaultPath = `200_icon/02_icon_item/${code}.png`;
			const realPath = `${matchedDir}/${dbFilename}`;
			if (realPath !== defaultPath) {
				manifest[code] = realPath.replace(/\.png$/, "");
			}
			viaDirect++;
			continue;
		}
	}

	// 2. Items dir : *_${code}.png ou ${code}.png.
	const itemSet = dirIndexes["200_icon/02_icon_item"];
	if (itemSet) {
		const exact = `${code}.png`;
		if (itemSet.has(exact)) {
			// Match par défaut (code seul) — pas besoin de manifest.
			viaInternalCode++;
			continue;
		}
		const suffix = `_${code}.png`;
		const found = [...itemSet].find((f) => f.endsWith(suffix));
		if (found) {
			manifest[code] = `200_icon/02_icon_item/${found.replace(/\.png$/, "")}`;
			viaInternalCode++;
			continue;
		}
	}

	// 3. Skill telop : ${code}_${code}.png dans fr/ puis en/.
	for (const dir of ["220_img/telop_waza/fr", "220_img/telop_waza/en"]) {
		const candidate = `${code}_${code}.png`;
		if (dirIndexes[dir]?.has(candidate)) {
			manifest[code] = `${dir}/${code}_${code}`;
			viaSkillTelop++;
			break;
		}
	}
	if (manifest[code]) {
		continue;
	}

	unresolved++;
	if (unresolvedSamples.length < 15) {
		unresolvedSamples.push(code);
	}
}

const out = "data/item-image-manifest.json";
await Bun.write(out, JSON.stringify(manifest, null, 2));

console.log("");
console.log(`Manifest entries: ${Object.keys(manifest).length}`);
console.log(`Resolved via DB image_url (no manifest needed): ${viaDirect}`);
console.log(`Resolved via internal_code lookup: ${viaInternalCode}`);
console.log(`Resolved via skill telop fallback: ${viaSkillTelop}`);
console.log(`Unresolved: ${unresolved}`);
if (unresolvedSamples.length > 0) {
	console.log(`Unresolved samples: ${unresolvedSamples.join(", ")}`);
}
console.log(`Written: ${out}`);
