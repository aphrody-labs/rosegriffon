/**
 * @file generate-img-inventory.ts
 * @description Genere un inventaire des fichiers image depuis le bucket Supabase Storage (menu/220_img/).
 *
 * Run: bun src/scripts/generate-img-inventory.ts
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = import.meta.dir;
const ENTRIES_DIR = join(__dirname, "../entries");
const OUT_PATH = join(ENTRIES_DIR, "img_inventory.json");

const BUCKET = "menu";
const PREFIX = "220_img";

interface InventoryItem {
	id: string;
	folder: string;
	subfolder: string | null;
	filename: string;
	path: string;
	size: number;
	mime: string;
}

const MIME_MAP: Record<string, string> = {
	".webp": "image/webp",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
};

function getMime(filename: string): string {
	const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
	return MIME_MAP[ext] ?? "application/octet-stream";
}

function pathToId(path: string): string {
	const h = Bun.hash(path);
	return `0x${h.toString(16).toUpperCase().padStart(16, "0")}`;
}

async function listAllFiles(
	storage: ReturnType<ReturnType<typeof createClient>["storage"]["from"]>,
	prefix: string
): Promise<{ name: string; metadata?: { size?: number } }[]> {
	const all: { name: string; metadata?: { size?: number } }[] = [];
	let offset = 0;
	const limit = 1000;

	while (true) {
		const { data, error } = await storage.list(prefix, {
			limit,
			offset,
			sortBy: { column: "name", order: "asc" },
		});

		if (error) {
			console.error(`  Erreur listing ${prefix}:`, error.message);
			break;
		}
		if (!data || data.length === 0) break;

		all.push(...data.map((f) => ({ name: f.name, metadata: f.metadata ?? undefined })));
		if (data.length < limit) break;
		offset += limit;
	}

	return all;
}

async function main() {
	console.log("=== generate-img-inventory.ts (Supabase Storage) ===");
	console.time("total");

	const url =
		process.env.NEXT_PUBLIC_SUPABASE_URL ||
		process.env.SUPABASE_URL ||
		"https://isbkaeltubqittywibeh.supabase.co";
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!key) {
		console.error("[ERREUR] SUPABASE_SERVICE_ROLE_KEY manquante");
		process.exit(1);
	}

	const supabase = createClient(url, key);
	const storage = supabase.storage.from(BUCKET);

	console.log(`Bucket: ${BUCKET}, prefix: ${PREFIX}/`);
	console.log(`URL: ${url}\n`);

	// 1. Lister les dossiers de premier niveau dans 220_img/
	const topLevel = await listAllFiles(storage, PREFIX);
	const folders = topLevel.filter((f) => !f.name.includes(".")).map((f) => f.name);
	const topFiles = topLevel.filter((f) => f.name.includes("."));

	console.log(`Dossiers trouves: ${folders.length}`);

	const inventory: InventoryItem[] = [];

	// Fichiers a la racine du prefix
	for (const file of topFiles) {
		inventory.push({
			id: pathToId(`${file.name}`),
			folder: "",
			subfolder: null,
			filename: file.name,
			path: file.name,
			size: file.metadata?.size ?? 0,
			mime: getMime(file.name),
		});
	}

	// 2. Pour chaque dossier, lister recursivement
	for (const folder of folders) {
		process.stdout.write(`  ${folder.padEnd(35)}`);
		const folderPath = `${PREFIX}/${folder}`;

		const items = await listAllFiles(storage, folderPath);
		const subFolders = items.filter((f) => !f.name.includes(".")).map((f) => f.name);
		const files = items.filter((f) => f.name.includes("."));

		// Fichiers directement dans le dossier
		for (const file of files) {
			const relPath = `${folder}/${file.name}`;
			inventory.push({
				id: pathToId(relPath),
				folder,
				subfolder: null,
				filename: file.name,
				path: relPath,
				size: file.metadata?.size ?? 0,
				mime: getMime(file.name),
			});
		}

		// Sous-dossiers (ex: fr/, ja/)
		for (const sub of subFolders) {
			const subPath = `${PREFIX}/${folder}/${sub}`;
			const subItems = await listAllFiles(storage, subPath);
			const subFiles = subItems.filter((f) => f.name.includes("."));

			for (const file of subFiles) {
				const relPath = `${folder}/${sub}/${file.name}`;
				inventory.push({
					id: pathToId(relPath),
					folder,
					subfolder: sub,
					filename: file.name,
					path: relPath,
					size: file.metadata?.size ?? 0,
					mime: getMime(file.name),
				});
			}
		}

		console.log(
			`${(files.length + subFolders.reduce((s) => s, 0)).toString().padStart(5)} fichiers`
		);
	}

	inventory.sort((a, b) => a.path.localeCompare(b.path));

	// Stats
	const byFolder: Record<string, number> = {};
	for (const item of inventory) {
		byFolder[item.folder] = (byFolder[item.folder] ?? 0) + 1;
	}
	const folderList = Object.entries(byFolder).sort((a, b) => b[1] - a[1]);
	console.log(`\nRepartition (${folderList.length} dossiers):`);
	for (const [f, count] of folderList) {
		console.log(`  ${f.padEnd(35)} ${count}`);
	}

	const bytes = await Bun.write(OUT_PATH, JSON.stringify(inventory, null, 2));

	console.timeEnd("total");
	console.log(`\nFichier ecrit: ${OUT_PATH} (${(bytes / 1024).toFixed(1)} KB)`);
	console.log(`Total entrees : ${inventory.length}`);
}

main().catch((e) => {
	console.error("[FATAL]", e);
	process.exit(1);
});
