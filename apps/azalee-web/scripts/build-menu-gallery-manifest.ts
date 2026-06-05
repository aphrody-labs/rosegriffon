#!/usr/bin/env bun
/**
 * Génère `data/menu-gallery-manifest.json` (tracké git) : la liste exhaustive des
 * illustrations du dossier jeu `dx11/menu/220_img/<dir>/` qui ne sont PAS déjà
 * exposées par la galerie DB (`inagle_gallery` / `inagle_scene_archives`).
 *
 * Les fichiers du dump sont nommés en doublé `<nom>_<nom>.png` → l'URL CDN est
 * DIRECTE, sans aucune transformation :
 *   https://cdn.rosegriffon.fr/dx11/menu/220_img/<dir>/<filename>.png
 * (le CDN sert ces assets live depuis les CPK — couverture vérifiée HTTP 200).
 *
 * Sortie = `{ items: GalleryManifestItem[], counts: Record<dir, number> }` où chaque
 * item porte `{ id, dir, file, title, category }`. Le `file` est le nom RÉEL du
 * fichier (avec le doublé + l'extension), le `title` est dérivé du basename nettoyé.
 *
 * Run : `bun scripts/build-menu-gallery-manifest.ts`
 */
const MENU_ROOT =
	process.env.IEVR_MENU_ROOT ?? `${process.env.DATA_PATH ?? "/home/ubuntu/niers/data"}/dx11/menu`;

/**
 * Dossiers du dump à indexer. `subdirs` liste les sous-dossiers à scanner sous le
 * dossier racine (pour `telop_waza` les illustrations vivent dans `fr/` et `en/`).
 * Le `dir` stocké dans le manifeste est le chemin relatif sous `220_img/` (segment
 * de langue inclus) → l'URL CDN se construit sans ambiguïté.
 */
const MENU_DIRS: ReadonlyArray<{ category: string; root: string; subdirs?: string[] }> = [
	{ category: "gallery_img2", root: "gallery_img2" },
	{ category: "ev_pic", root: "ev_pic" },
	{ category: "stadium", root: "stadium" },
	{ category: "vsroute_map", root: "vsroute_map" },
	{ category: "hlp", root: "hlp" },
	{ category: "telop_waza", root: "telop_waza", subdirs: ["fr", "en"] },
];

interface GalleryManifestItem {
	id: string;
	dir: string;
	file: string;
	title: string;
	category: string;
}

/**
 * Dérive le nom logique d'un fichier doublé `<nom>_<nom>.png` → `<nom>`.
 * Si le pattern doublé n'est pas détecté, on retombe sur le basename sans extension.
 */
function logicalName(file: string): string {
	const base = file.replace(/\.png$/i, "");
	const half = Math.floor((base.length - 1) / 2);
	if (base.length % 2 === 1) {
		const left = base.slice(0, half);
		const right = base.slice(half + 1);
		if (base[half] === "_" && left === right) {
			return left;
		}
	}
	return base;
}

/** Titre lisible : retire les préfixes décoratifs, remplace `_` par espaces, Title Case. */
function titleOf(file: string): string {
	const cleaned = logicalName(file)
		.replace(/^(img_|back_|hlp_|grid_)/, "")
		.replaceAll("_", " ")
		.trim();
	return cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) || logicalName(file);
}

const items: GalleryManifestItem[] = [];
const counts: Record<string, number> = {};

for (const def of MENU_DIRS) {
	const scanDirs = def.subdirs
		? def.subdirs.map((s) => ({ rel: `${def.root}/${s}`, fs: `${def.root}/${s}` }))
		: [{ rel: def.root, fs: def.root }];

	let dirCount = 0;
	for (const sd of scanDirs) {
		const files: string[] = [];
		try {
			const glob = new Bun.Glob("*.png");
			for await (const f of glob.scan({ cwd: `${MENU_ROOT}/220_img/${sd.fs}` })) {
				files.push(f);
			}
		} catch {
			console.warn(`Skip missing dir: 220_img/${sd.fs}`);
			continue;
		}
		files.sort();
		for (const file of files) {
			// Filtre les PNG 0-octet : g4tx indécodables (pré-extracteur a écrit un
			// fichier vide ; le décodeur live hang aussi dessus). Les lister donnerait
			// des vignettes mortes + un hang 30s du service de variantes (sharp sur 0
			// octet → 504) qui bloque le pool de connexions du navigateur.
			if (Bun.file(`${MENU_ROOT}/220_img/${sd.fs}/${file}`).size === 0) {
				continue;
			}
			items.push({
				id: `menu_${sd.rel.replaceAll("/", "_")}_${logicalName(file)}`,
				dir: sd.rel,
				file,
				title: titleOf(file),
				category: def.category,
			});
			dirCount++;
		}
	}
	counts[def.category] = dirCount;
	console.log(`Scanned ${def.category}: ${dirCount} files`);
}

const out = "data/menu-gallery-manifest.json";
await Bun.write(out, `${JSON.stringify({ counts, items }, null, 2)}\n`);

console.log("");
console.log(`Total menu illustrations: ${items.length}`);
console.log(`Written: ${out}`);
