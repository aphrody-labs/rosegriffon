/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DOCS_DIR = "/home/ubuntu/rg/docs";
// Les docs de référence externes (crawlées) sont isolées dans docs/reference/
// pour ne pas polluer la racine des docs-projet écrits à la main.
const REFERENCE_DIR = join(DOCS_DIR, "reference");

/**
 * Récupère les documentations de référence sur Markdown et Bun.markdown
 * pour les intégrer au monorepo et au RAG/LLM.
 */
export async function crawlExternalDocs(): Promise<{ success: boolean; error?: string }> {
	console.log("[Crawl External Docs] Récupération de awesome-markdown & bun-markdown...");

	try {
		await mkdir(REFERENCE_DIR, { recursive: true });
		// 1. Fetch awesome-markdown README
		const awesomeRes = await fetch(
			"https://raw.githubusercontent.com/mundimark/awesome-markdown/master/README.md"
		);
		if (!awesomeRes.ok) {
			throw new Error(`Failed to fetch awesome-markdown (status ${awesomeRes.status})`);
		}
		let awesomeContent = await awesomeRes.text();

		// Remplacer les liens relatifs .md par des URLs absolues sur GitHub pour éviter les liens brisés locaux
		awesomeContent = awesomeContent.replaceAll(
			/\]\((?!http|https|mailto:|#)([^)]+\.md)\)/g,
			"](https://github.com/mundimark/awesome-markdown/blob/master/$1)"
		);

		const awesomeFrontmatter = `---
title: "Awesome Markdown"
description: "Index de ressources Markdown de référence compilé par mundimark (outils, extensions, spécifications)."
scope: ["markdown", "ref"]
status: "stable"
---

`;
		await writeFile(join(REFERENCE_DIR, "awesome-markdown.md"), awesomeFrontmatter + awesomeContent);
		console.log("[Crawl External Docs] Fichier awesome-markdown.md enregistré.");

		// 2. Fetch Bun markdown docs (MDX)
		const bunRes = await fetch(
			"https://raw.githubusercontent.com/oven-sh/bun/main/docs/runtime/markdown.mdx"
		);
		if (!bunRes.ok) {
			throw new Error(`Failed to fetch Bun markdown docs (status ${bunRes.status})`);
		}
		let bunContent = await bunRes.text();

		if (!bunContent.startsWith("---")) {
			const bunFrontmatter = `---
title: "Bun Markdown Runtime API"
description: "Documentation de l'API native Bun.markdown de Bun pour le parsing et rendu de Markdown à haute performance."
scope: ["bun", "markdown", "runtime"]
status: "stable"
---

`;
			bunContent = bunFrontmatter + bunContent;
		} else {
			// Injecter scope et status s'ils ne sont pas présents
			bunContent = bunContent.replace(/^---([\s\S]*?)---/, (_, p1) => {
				let parsed = p1;
				if (!parsed.includes("scope:")) {
					parsed += '\nscope: ["bun", "markdown", "runtime"]';
				}
				if (!parsed.includes("status:")) {
					parsed += '\nstatus: "stable"';
				}
				// Remplacer le titre générique par un titre plus explicite
				parsed = parsed.replace(
					/^title:\s*["']?Markdown["']?/m,
					'title: "Bun Markdown Runtime API"'
				);
				return `---\n${parsed.trim()}\n---`;
			});
		}

		await writeFile(join(REFERENCE_DIR, "bun-markdown.md"), bunContent);
		console.log("[Crawl External Docs] Fichier bun-markdown.md enregistré.");

		return { success: true };
	} catch (err: any) {
		console.error("[Crawl External Docs] Échec du crawling externe :", err);
		return { success: false, error: err.message || String(err) };
	}
}
