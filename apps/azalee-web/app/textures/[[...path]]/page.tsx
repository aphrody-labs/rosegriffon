/**
 * Galerie de textures — les 53 126 fichiers `.g4tx` du jeu, décodés en PNG à la volée.
 *
 * La galerie `/gallery` sert 360 illustrations curées (table `inagle_gallery`) : c'est une
 * sélection éditoriale, pas le corpus. Cette page-ci est le corpus, parcouru par dossier sur le
 * VFS **live** (`/vfs/ls`) : `dx11/menu` en porte 40 158 à lui seul, dont 19 245 d'icônes.
 *
 * Chaque vignette est un WebP redimensionné par le CDN (`?w=…&format=webp`, ~10 ko) et non le
 * PNG plein cadre (~60 ko et plus) : à 120 images par page, la différence est celle entre une
 * page qui s'affiche et une page qui ne s'affiche pas.
 *
 * Server Component : aucune donnée n'est bundlée, tout vient du pont VFS au rendu.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { lsOrNull } from "@rosegriffon/azalee/cpk/live";
import { cpkAssetUrl, cpkThumbUrl, segLabel } from "@rosegriffon/azalee/cpk/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Racine du sous-arbre exploré : les `.g4tx` vivent tous sous `data/dx11/`. */
const RACINE = "data/dx11";
/** Textures par page — borne le nombre de requêtes de vignettes qu'un rendu déclenche. */
const PAR_PAGE = 120;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
	const { path } = await params;
	const segments = path ?? [];
	const titre = segments.length > 0 ? segments.map(segLabel).join(" › ") : "Toutes les textures";
	return {
		alternates: { canonical: `/textures${segments.length ? `/${segments.join("/")}` : ""}` },
		description: `Textures d'Inazuma Eleven: Victory Road décodées depuis les fichiers du jeu — ${titre}.`,
		title: `Textures — ${titre} | Azalée`,
	};
}

export default async function TexturesPage({
	params,
	searchParams,
}: {
	params: Promise<{ path?: string[] }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const [{ path }, sp] = await Promise.all([params, searchParams]);
	const segments = (path ?? []).filter((s) => s !== ".." && s !== ".");
	const dir = segments.length > 0 ? `${RACINE}/${segments.join("/")}` : RACINE;

	const pageParam = typeof sp.page === "string" ? Number.parseInt(sp.page, 10) : 1;
	const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
	const offset = (page - 1) * PAR_PAGE;

	const listing = await lsOrNull(dir, PAR_PAGE, offset);

	if (!listing) {
		return (
			<div className="rounded-[32px] border border-dashed border-outline-variant bg-surface-container-low py-20 text-center">
				<p className="italic text-on-surface-variant">
					Le VFS du jeu est momentanément injoignable — les textures ne peuvent pas être listées.
				</p>
			</div>
		);
	}

	const textures = listing.files.filter((f) => f.ext === "g4tx");
	const pages = Math.max(1, Math.ceil(listing.fileTotal / PAR_PAGE));
	const base = `/textures${segments.length ? `/${segments.join("/")}` : ""}`;

	return (
		<div className="w-full space-y-5">
			<header className="space-y-1">
				<h1 className="text-fluid-headline-md font-extrabold text-on-surface">Textures</h1>
				<nav className="flex flex-wrap items-center gap-1 text-sm text-on-surface-variant">
					<Link href="/textures" className="hover:text-primary">
						dx11
					</Link>
					{segments.map((seg, i) => (
						<span key={`${seg}-${i}`} className="flex items-center gap-1">
							<span aria-hidden>›</span>
							<Link
								href={`/textures/${segments.slice(0, i + 1).join("/")}`}
								className="hover:text-primary"
							>
								{segLabel(seg)}
							</Link>
						</span>
					))}
				</nav>
				{listing.role && (
					<p className="text-xs text-on-surface-variant">
						{listing.role.role} — {listing.role.status}
					</p>
				)}
			</header>

			{listing.dirs.length > 0 && (
				<ul className="flex flex-wrap gap-2">
					{listing.dirs.map((d) => (
						<li key={d.name}>
							<Link
								href={`${base}/${d.name}`}
								className="flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-sm text-on-surface transition hover:border-primary/50 hover:bg-surface-container"
							>
								<span>{segLabel(d.name)}</span>
								<span className="text-xs text-on-surface-variant">
									{d.count.toLocaleString("fr")}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}

			{listing.fileTotal > 0 && (
				<p className="px-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
					{textures.length.toLocaleString("fr")} texture{textures.length > 1 ? "s" : ""} sur{" "}
					{listing.fileTotal.toLocaleString("fr")} fichier
					{listing.fileTotal > 1 ? "s" : ""} — page {page} sur {pages}
				</p>
			)}

			{textures.length > 0 ? (
				<ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
					{textures.map((t) => (
						<li key={t.path}>
							<a
								href={cpkAssetUrl(t.path, t.ext) ?? "#"}
								target="_blank"
								rel="noreferrer"
								className="group block overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container transition hover:border-primary/50"
							>
								<span className="flex aspect-square items-center justify-center bg-surface-container-high bg-[linear-gradient(45deg,rgba(128,128,128,.12)_25%,transparent_25%,transparent_75%,rgba(128,128,128,.12)_75%),linear-gradient(45deg,rgba(128,128,128,.12)_25%,transparent_25%,transparent_75%,rgba(128,128,128,.12)_75%)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]">
									{/* Vignette CDN : `next/image` est inutile ici, le CDN redimensionne déjà. */}
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={cpkThumbUrl(t.path, t.ext, 400) ?? ""}
										alt={t.name}
										loading="lazy"
										decoding="async"
										className="max-h-full max-w-full object-contain"
									/>
								</span>
								<span
									className="block truncate px-2 py-1.5 font-mono text-[11px] text-on-surface-variant group-hover:text-on-surface"
									title={t.name}
								>
									{t.name.replace(/\.g4tx$/i, "")}
								</span>
							</a>
						</li>
					))}
				</ul>
			) : (
				listing.dirs.length === 0 && (
					<p className="py-16 text-center text-sm italic text-on-surface-variant">
						Aucune texture dans ce dossier.
					</p>
				)
			)}

			{pages > 1 && (
				<nav className="flex items-center justify-center gap-3 pt-2 text-sm">
					{page > 1 && (
						<Link
							href={`${base}?page=${page - 1}`}
							className="rounded-full bg-surface-container px-4 py-2 text-on-surface transition hover:bg-surface-container-high"
						>
							Précédent
						</Link>
					)}
					<span className="text-on-surface-variant">
						{page} / {pages}
					</span>
					{page < pages && (
						<Link
							href={`${base}?page=${page + 1}`}
							className="rounded-full bg-surface-container px-4 py-2 text-on-surface transition hover:bg-surface-container-high"
						>
							Suivant
						</Link>
					)}
				</nav>
			)}
		</div>
	);
}
