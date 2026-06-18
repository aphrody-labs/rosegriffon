/**
 * Galerie vidéo — expose les cinématiques USM d'Inazuma Eleven: Victory Road, décodées **à la
 * volée** par nie-model-serve (route CDN `/video/<vfs-path>` : démux USM Sofdec2 → MP4 H.264
 * fragmenté, seek par Range). C'est l'une des capacités niers (vidéo) non encore exploitée par
 * azalee — intégration « niers → azalee ».
 *
 * Server Component (`force-dynamic`) : liste les `.usm` de `data/common/movie` depuis l'index CPK
 * (lib serveur `lib/cpk/index`), puis délègue le rendu à l'îlot client `VideoGallery` qui lit le
 * flux MP4 à la demande (`cpkVideoUrl`, client-safe). Pas de prerender (l'index n'est pas bundlé).
 */
import type { Metadata } from "next";
import { VideoGallery, type MovieEntry } from "@/app/videos/VideoGallery";
import { listDir } from "@/lib/cpk/index";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
	alternates: { canonical: "/videos" },
	description:
		"Cinématiques et vidéos d'Inazuma Eleven: Victory Road (écrans-titre, événements), décodées à la volée depuis les fichiers du jeu (USM → MP4).",
	openGraph: {
		description:
			"Toutes les cinématiques d'Inazuma Eleven: Victory Road, décodées live depuis les CPK.",
		locale: "fr_FR",
		siteName: "Azalée - Inazuma Eleven Victory Road",
		title: "Vidéos & cinématiques | Azalée",
		type: "website",
		url: "/videos",
	},
	title: "Vidéos & cinématiques — Inazuma Eleven Victory Road - Azalée",
};

/** Classe un nom de fichier `.usm` en catégorie humaine (sans inventer de titre). */
function classify(name: string): MovieEntry["kind"] {
	if (/title/i.test(name)) return "title";
	if (/^chronicle/i.test(name)) return "chronicle";
	if (/^ev\d/i.test(name)) return "event";
	return "other";
}

export default function VideosPage() {
	// Les `.usm` canoniques vivent sous `common/movie` (le miroir `dx11/movie` est le doublon PC).
	const listing = listDir("data/common/movie");
	const movies: MovieEntry[] = listing.files
		.filter((f) => f.ext === "usm")
		.map((f) => ({
			path: f.path,
			name: f.name.replace(/\.usm$/i, ""),
			kind: classify(f.name),
		}))
		.sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));

	return (
		<div className="w-full space-y-6">
			<header className="space-y-1">
				<h1 className="text-fluid-headline-md font-extrabold text-on-surface">
					Vidéos & cinématiques
				</h1>
				<p className="text-sm text-on-surface-variant max-w-2xl">
					{movies.length.toLocaleString("fr")} cinématiques d'Inazuma Eleven: Victory Road,
					décodées à la volée depuis les fichiers du jeu (USM → MP4 H.264). Lecture et
					téléchargement à la demande.
				</p>
			</header>
			<VideoGallery movies={movies} />
		</div>
	);
}
