import { readdir, readFile, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";

const ROOT_DIR = resolve(import.meta.dirname, "..");
const DOCS_DIR = join(ROOT_DIR, "docs");

async function getFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const res = join(dir, entry.name);
			return entry.isDirectory() ? getFiles(res) : res;
		})
	);
	return files.flat().filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
}

async function verifyPath(filePath: string): Promise<boolean> {
	try {
		const s = await stat(filePath);
		return s.isFile() || s.isDirectory();
	} catch {
		return false;
	}
}

async function checkLinks() {
	console.log("🔗 Vérification des liens de documentation...");

	const files = await getFiles(DOCS_DIR);
	let totalLinks = 0;
	let brokenLinks = 0;

	for (const file of files) {
		// Ignorer les fichiers de bundle générés qui contiennent beaucoup de liens absolus virtuels
		if (file.endsWith("llms.txt") || file.endsWith("llms-full.txt")) continue;

		const content = await readFile(file, "utf-8");
		const relativeFile = file.replace(ROOT_DIR, "").replace(/^\//, "");
		const fileDir = dirname(file);

		// Regex pour capturer les liens Markdown [texte](url)
		// Ignorer les URLs externes commençant par http/https/mailto
		const linkRegex = /\[[^\]]*?\]\(([^)]+?)\)/g;
		let match;

		while ((match = linkRegex.exec(content)) !== null) {
			const linkUrl = match[1].trim();

			// Ignorer les liens externes
			if (
				linkUrl.startsWith("http://") ||
				linkUrl.startsWith("https://") ||
				linkUrl.startsWith("mailto:")
			) {
				continue;
			}

			// Ignorer les ancres de même page (#...)
			if (linkUrl.startsWith("#")) {
				continue;
			}

			totalLinks++;
			let targetPath = "";

			if (linkUrl.startsWith("file:///")) {
				// Lien absolu virtuel par rapport à la racine du monorepo (ex: file:///docs/PLAN.md)
				const subPath = linkUrl.replace("file:///", "");
				targetPath = join(ROOT_DIR, subPath);
			} else {
				// Lien relatif (ex: ./database.md ou ../packages/...)
				// Supprimer l'ancre si elle existe (ex: database.md#cache-redis)
				const urlWithoutAnchor = linkUrl.split("#")[0] || "";
				if (!urlWithoutAnchor) continue;
				targetPath = resolve(fileDir, urlWithoutAnchor);
			}

			const exists = await verifyPath(targetPath);
			if (!exists) {
				console.error(
					`❌ Lien cassé dans [${relativeFile}] : "${linkUrl}" (Cible non trouvée: ${targetPath})`
				);
				brokenLinks++;
			}
		}
	}

	console.log(`\n📊 Bilan de la vérification :`);
	console.log(`   - Liens locaux vérifiés : ${totalLinks}`);
	console.log(`   - Liens cassés trouvés  : ${brokenLinks}`);

	if (brokenLinks > 0) {
		process.exit(1);
	} else {
		console.log("💚 Tous les liens internes sont valides !");
		process.exit(0);
	}
}

checkLinks().catch(console.error);
