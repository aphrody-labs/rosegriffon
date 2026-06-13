/**
 * API REST de l'index CPK — navigateur d'arbre des fichiers IEVR.
 *
 *   GET /api/cpk?path=<dir>            → listing JSON { dir, dirs[], files[] }
 *   GET /api/cpk?path=<file>&meta=1    → métadonnées du fichier + URL CDN du contenu
 *
 * Source : `lib/cpk/index.ts` (SQLite matérialisé depuis l'index Redis db3,
 * `import "server-only"`). Le CONTENU décodé d'un fichier est servi par le CDN
 * (`assetUrl`/`thumbUrl`) ; cette API ne renvoie que la structure + les URLs.
 *
 * `runtime = "nodejs"` (bun:sqlite, pas Edge). Listing immutable côté client
 * (l'index ne change qu'à la régénération de l'artefact) → cache court.
 */
import { NextResponse } from "next/server";
import { fileMeta, listDir, searchFiles } from "@/lib/cpk/index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): NextResponse {
	const { searchParams } = new URL(request.url);
	const rawPath = searchParams.get("path") ?? "";
	const wantMeta = searchParams.get("meta") === "1";
	const query = searchParams.get("q");

	// Garde-fou : pas de `..`, on borne au sous-arbre `data/` de l'index.
	if (rawPath.includes("..")) {
		return NextResponse.json({ error: "invalid path" }, { status: 400 });
	}

	try {
		if (query != null) {
			const files = searchFiles(query, 200);
			return NextResponse.json(
				{ query, files, count: files.length },
				{ headers: { "Cache-Control": "public, max-age=60" } },
			);
		}
		if (wantMeta) {
			const meta = fileMeta(rawPath);
			if (!meta) {
				return NextResponse.json({ error: "not found", path: rawPath }, { status: 404 });
			}
			return NextResponse.json(meta, {
				headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
			});
		}

		const listing = listDir(rawPath);
		return NextResponse.json(listing, {
			headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "internal error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
