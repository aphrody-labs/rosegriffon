/**
 * Galerie vidéo — les cinématiques USM d'Inazuma Eleven: Victory Road, décodées **à la volée**
 * par nie-model-serve (route CDN `/video/<vfs-path>` : démux USM Sofdec2 → MP4 H.264 fragmenté,
 * seek par Range).
 *
 * Server Component (`force-dynamic`) : la liste vient du VFS **live** (`/vfs/ls`, crate
 * `nie_explore::listing`) et non de l'index CPK figé, puis l'îlot client `VideoGallery` lit le
 * flux MP4 à la demande.
 *
 * ⚠ `dx11/movie` n'est PAS un doublon de `common/movie`, contrairement à ce que cette page
 * affirmait. Les deux dossiers portent les 96 mêmes noms, mais AUCUN fichier n'a la même taille :
 * 16,1 Gio contre 3,7 Gio. Vérifié au ffprobe sur `Chronicle_Title_JP_01` — même définition
 * (1920×1080), débit 3,8× supérieur côté dx11. C'est la variante PC de meilleure qualité, et
 * c'est elle qu'on sert désormais ; `common/movie` ne sert que de repli pour un titre qui n'y
 * serait pas.
 */
import type { Metadata } from "next";
import { VideoGallery, type MovieEntry } from "@/app/videos/VideoGallery";
import { MediaEmpty, MediaHeader } from "@/components/wiki/MediaShell";
import { videoLabel } from "@/lib/cpk/media-names";
import { lsOrNull } from "@rosegriffon/azalee/cpk/live";

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

export default async function VideosPage() {
	// dx11 d'abord : c'est la variante à haut débit. `common` complète ce qui manquerait.
	const [hd, sd] = await Promise.all([
		lsOrNull("data/dx11/movie", 500),
		lsOrNull("data/common/movie", 500),
	]);

	const parNom = new Map<string, MovieEntry>();
	for (const [listing, variante] of [
		[sd, "standard"],
		[hd, "haute"],
	] as const) {
		for (const f of listing?.files ?? []) {
			if (f.ext !== "usm") continue;
			const name = f.name.replace(/\.usm$/i, "");
			// L'ordre d'insertion fait la priorité : `haute` écrase `standard`.
			parNom.set(name, {
				path: f.path,
				name,
				kind: classify(f.name),
				size: f.size,
				variante,
				title: name,
				context: null,
			});
		}
	}

	// Le code de fichier n'est pas un titre : on résout un vrai libellé quand les données du jeu
	// en portent un (épisode via `inagle_events`, langue des écrans-titre), et le code passe en
	// sous-titre. Résolu ici, côté serveur, parce que la table vit dans le miroir SQLite.
	for (const [nom, entree] of parNom) {
		const label = await videoLabel(nom);
		entree.title = label.title;
		entree.context = label.context;
	}

	const movies = [...parNom.values()].toSorted((a, b) =>
		a.name.localeCompare(b.name, "fr", { numeric: true }),
	);
	const hautes = movies.filter((m) => m.variante === "haute").length;

	return (
		<div className="w-full space-y-6">
			<MediaHeader
				title="Vidéos & cinématiques"
				active="/videos"
				description={
					`${movies.length.toLocaleString("fr")} cinématiques d'Inazuma Eleven: Victory Road, ` +
					`décodées à la volée depuis les fichiers du jeu (USM → MP4 H.264). Lecture et ` +
					`téléchargement à la demande.` +
					(hautes > 0
						? ` ${hautes.toLocaleString("fr")} sont servies dans leur variante PC haut débit.`
						: "")
				}
			/>

			{movies.length === 0 ? (
				<MediaEmpty>
					Le VFS du jeu est momentanément injoignable — la liste des cinématiques ne peut pas être
					établie.
				</MediaEmpty>
			) : (
				<VideoGallery movies={movies} />
			)}
		</div>
	);
}
