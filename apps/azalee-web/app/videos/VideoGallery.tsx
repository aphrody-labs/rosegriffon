"use client";

/**
 * Grille des cinématiques (îlot client). Chaque carte lit le flux MP4 **à la demande**
 * (`preload="none"` : aucun octet réseau tant qu'on ne lance pas la lecture) — indispensable avec
 * ~94 vidéos, car chaque flux déclenche un démux USM→MP4 live côté CDN. Filtre par catégorie +
 * recherche, lecture inline, téléchargement (MP4 décodé ou USM original).
 */
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cpkRawUrl, cpkVideoUrl } from "@rosegriffon/azalee/cpk/shared";

export interface MovieEntry {
	/** Chemin VFS complet (`data/dx11/movie/<name>.usm`). */
	path: string;
	/** Nom sans extension. */
	name: string;
	kind: "title" | "chronicle" | "event" | "other";
	/** Taille du USM d'origine, en octets. */
	size: number;
	/** Variante servie : `haute` = dx11 (débit PC), `standard` = common. */
	variante: "haute" | "standard";
}

/** Taille en unités binaires, telle qu'on l'annonce à côté d'un lien de téléchargement. */
function formatSize(octets: number): string {
	const mio = octets / 1024 ** 2;
	return mio >= 1024
		? `${(mio / 1024).toFixed(1).replace(".", ",")} Gio`
		: `${Math.round(mio)} Mio`;
}

const KIND_LABEL: Record<MovieEntry["kind"], string> = {
	chronicle: "Chronique",
	event: "Événement",
	other: "Autre",
	title: "Écran-titre",
};

const FILTERS: Array<{ id: "all" | MovieEntry["kind"]; label: string }> = [
	{ id: "all", label: "Toutes" },
	{ id: "title", label: "Écrans-titre" },
	{ id: "chronicle", label: "Chroniques" },
	{ id: "event", label: "Événements" },
	{ id: "other", label: "Autres" },
];

function MovieCard({ movie }: { movie: MovieEntry }) {
	const [active, setActive] = useState(false);
	const videoUrl = cpkVideoUrl(movie.path);
	return (
		<div className="group rounded-2xl overflow-hidden bg-surface-container border border-outline-variant/20 hover:border-primary/40 transition-colors">
			<div className="relative aspect-video bg-surface-container-high">
				{active ? (
					// eslint-disable-next-line jsx-a11y/media-has-caption
					<video
						controls
						autoPlay
						preload="metadata"
						className="absolute inset-0 size-full bg-black"
						src={videoUrl}
					/>
				) : (
					<button
						type="button"
						onClick={() => setActive(true)}
						className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
						aria-label={`Lire ${movie.name}`}
					>
						<Icon name="play_circle" size={56} />
						<span className="text-xs">Lire</span>
					</button>
				)}
			</div>
			<div className="p-2.5 min-w-0">
				<p className="truncate text-sm font-medium text-on-surface" title={movie.name}>
					{movie.name}
				</p>
				<div className="mt-1 flex items-center justify-between gap-2">
					<span className="text-[11px] text-on-surface-variant/70">
						{KIND_LABEL[movie.kind]}
						{movie.variante === "haute" && (
							<span title="Variante PC, débit supérieur"> · HD</span>
						)}
						{" · "}
						{formatSize(movie.size)}
					</span>
					<span className="flex items-center gap-2">
						<a
							href={videoUrl}
							download={`${movie.name}.mp4`}
							className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-primary transition-colors"
							title="Télécharger le MP4 décodé"
						>
							<Icon name="download" size={12} /> MP4
						</a>
						<a
							href={cpkRawUrl(movie.path)}
							download={`${movie.name}.usm`}
							className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant/70 hover:text-primary transition-colors"
							title="Télécharger l'original USM"
						>
							USM
						</a>
					</span>
				</div>
			</div>
		</div>
	);
}

export function VideoGallery({ movies }: { movies: MovieEntry[] }) {
	const [filter, setFilter] = useState<"all" | MovieEntry["kind"]>("all");
	const [query, setQuery] = useState("");

	const shown = useMemo(() => {
		const q = query.trim().toLowerCase();
		return movies.filter(
			(m) => (filter === "all" || m.kind === filter) && (q === "" || m.name.toLowerCase().includes(q)),
		);
	}, [movies, filter, query]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex items-center gap-2 flex-1 min-w-[12rem] h-10 px-3 rounded-full bg-surface-container-highest">
					<Icon name="search" size={18} className="text-on-surface-variant shrink-0" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Rechercher une vidéo…"
						className="flex-1 min-w-0 bg-transparent outline-none text-sm text-on-surface placeholder:text-on-surface-variant/60"
					/>
				</div>
				<div className="flex flex-wrap gap-1.5">
					{FILTERS.map((f) => (
						<button
							key={f.id}
							type="button"
							onClick={() => setFilter(f.id)}
							className={`h-9 px-3 rounded-full text-sm transition-colors ${
								filter === f.id
									? "bg-primary text-on-primary"
									: "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
							}`}
						>
							{f.label}
						</button>
					))}
				</div>
			</div>

			{shown.length === 0 ? (
				<p className="p-8 text-center text-sm text-on-surface-variant">Aucune vidéo.</p>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{shown.map((m) => (
						<MovieCard key={m.path} movie={m} />
					))}
				</div>
			)}
		</div>
	);
}
