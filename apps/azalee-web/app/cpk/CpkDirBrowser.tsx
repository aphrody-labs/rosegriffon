"use client";

/**
 * Navigateur d'un répertoire de l'index CPK : grille des sous-dossiers (avec
 * compte récursif) + liste des fichiers directs, avec recherche/filtre local.
 *
 * Reçoit le listing déjà fetché en props (la page serveur lit le SQLite miroir
 * via `lib/cpk/index.ts`). N'importe QUE le `-shared` client-safe.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
	cpkPreviewKind,
	cpkThumbUrl,
	previewKindLabel,
	segLabel,
	type CpkDir,
	type CpkFile,
} from "@/lib/cpk/shared";

export interface CpkDirBrowserProps {
	/** Chemin du répertoire courant (normalisé, ex. `data/common/chr`). */
	dir: string;
	dirs: CpkDir[];
	files: CpkFile[];
	/** Total de fichiers directs (peut dépasser `files.length` si paginé). */
	fileTotal: number;
	/** Offset de la page de fichiers courante. */
	fileOffset: number;
	/** Taille de page (pour calculer la pagination). */
	pageSize: number;
}

/** Construit l'URL de route `/cpk/...` pour un chemin d'index (sans `data/`). */
function cpkHref(indexPath: string): string {
	const rel = indexPath.replace(/^data\//, "");
	return `/cpk/${rel}`;
}

export function CpkDirBrowser({
	dir,
	dirs,
	files,
	fileTotal,
	fileOffset,
	pageSize,
}: CpkDirBrowserProps) {
	const [query, setQuery] = useState("");

	const q = query.trim().toLowerCase();
	const filteredDirs = useMemo(
		() => (q ? dirs.filter((d) => d.name.toLowerCase().includes(q)) : dirs),
		[dirs, q],
	);
	const filteredFiles = useMemo(
		() => (q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files),
		[files, q],
	);

	const paginated = fileTotal > pageSize;
	const page = Math.floor(fileOffset / pageSize) + 1;
	const pageCount = Math.ceil(fileTotal / pageSize);

	return (
		<div className="space-y-5">
			{/* Recherche locale */}
			<label className="relative block">
				<Icon
					name="search"
					size={18}
					className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60"
				/>
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Filtrer dossiers et fichiers de ce répertoire..."
					className="w-full h-11 pl-10 pr-4 rounded-full bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary"
				/>
			</label>

			{/* Sous-dossiers */}
			{filteredDirs.length > 0 && (
				<section className="space-y-3">
					<h2 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider px-1">
						{filteredDirs.length.toLocaleString("fr-FR")} dossier
						{filteredDirs.length > 1 ? "s" : ""}
					</h2>
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
						{filteredDirs.map((d) => (
							<Link
								key={d.name}
								href={cpkHref(`${dir}/${d.name}`)}
								className="group flex items-center gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-3 hover:border-primary hover:bg-surface-container transition"
							>
								<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
									<Icon name="grid_view" size={20} />
								</span>
								<span className="min-w-0">
									<span className="block truncate text-sm font-semibold text-on-surface group-hover:text-primary">
										{segLabel(d.name)}
									</span>
									<span className="block text-xs text-on-surface-variant tabular-nums">
										{d.count.toLocaleString("fr-FR")} fichier{d.count > 1 ? "s" : ""}
									</span>
								</span>
							</Link>
						))}
					</div>
				</section>
			)}

			{/* Fichiers */}
			{fileTotal > 0 && (
				<section className="space-y-3">
					<h2 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider px-1">
						{fileTotal.toLocaleString("fr-FR")} fichier{fileTotal > 1 ? "s" : ""}
						{paginated && (
							<span className="ml-1 text-on-surface-variant/60">
								· page {page}/{pageCount}
							</span>
						)}
					</h2>
					<ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{filteredFiles.map((f) => (
							<FileItem key={f.path} file={f} />
						))}
					</ul>
					{q && filteredFiles.length === 0 && (
						<p className="text-sm text-on-surface-variant px-1">
							Aucun fichier ne correspond sur cette page.
						</p>
					)}
					{paginated && <Pagination dir={dir} page={page} pageCount={pageCount} />}
				</section>
			)}

			{filteredDirs.length === 0 && fileTotal === 0 && (
				<div className="flex flex-col items-center gap-2 py-16 text-center">
					<Icon name="search_off" size={40} className="text-on-surface-variant/40" />
					<p className="text-sm text-on-surface-variant">Répertoire vide.</p>
				</div>
			)}
		</div>
	);
}

/** Une entrée fichier : vignette (si image) + nom + badge de type. */
function FileItem({ file }: { file: CpkFile }) {
	const kind = cpkPreviewKind(file.ext);
	const thumb = cpkThumbUrl(file.path, file.ext, 200);

	return (
		<li>
			<Link
				href={cpkHref(file.path)}
				className="group flex items-center gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-3 hover:border-primary transition"
			>
				<span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container">
					{thumb ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={thumb}
							alt=""
							loading="lazy"
							className="size-full object-contain"
						/>
					) : (
						<Icon name={iconForKind(kind)} size={22} className="text-on-surface-variant/60" />
					)}
				</span>
				<span className="min-w-0">
					<span className="block truncate font-mono text-xs font-semibold text-on-surface group-hover:text-primary">
						{file.name}
					</span>
					<span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
						{previewKindLabel(kind)}
					</span>
				</span>
			</Link>
		</li>
	);
}

function iconForKind(kind: ReturnType<typeof cpkPreviewKind>): string {
	switch (kind) {
		case "image":
			return "image";
		case "model":
			return "blur_on";
		case "sound":
			return "play_circle";
		case "movie":
			return "play_arrow";
		case "text":
			return "description";
		case "config":
			return "database";
		default:
			return "description";
	}
}

/** Pagination de fichiers via query `?p=` (la page serveur lit `searchParams`). */
function Pagination({
	dir,
	page,
	pageCount,
}: {
	dir: string;
	page: number;
	pageCount: number;
}) {
	const rel = dir.replace(/^data\//, "");
	const href = (p: number) => `/cpk/${rel}?p=${p}`;
	return (
		<nav className="flex items-center justify-center gap-2 pt-2" aria-label="Pagination">
			{page > 1 ? (
				<Link
					href={href(page - 1)}
					className="inline-flex items-center gap-1 h-9 px-3 rounded-full border border-outline-variant/40 text-sm text-on-surface hover:border-primary transition"
				>
					<Icon name="chevron_left" size={16} /> Préc.
				</Link>
			) : (
				<span className="inline-flex items-center gap-1 h-9 px-3 rounded-full border border-outline-variant/20 text-sm text-on-surface-variant/40">
					<Icon name="chevron_left" size={16} /> Préc.
				</span>
			)}
			<span className="text-sm text-on-surface-variant tabular-nums px-2">
				{page} / {pageCount}
			</span>
			{page < pageCount ? (
				<Link
					href={href(page + 1)}
					className="inline-flex items-center gap-1 h-9 px-3 rounded-full border border-outline-variant/40 text-sm text-on-surface hover:border-primary transition"
				>
					Suiv. <Icon name="chevron_right" size={16} />
				</Link>
			) : (
				<span className="inline-flex items-center gap-1 h-9 px-3 rounded-full border border-outline-variant/20 text-sm text-on-surface-variant/40">
					Suiv. <Icon name="chevron_right" size={16} />
				</span>
			)}
		</nav>
	);
}
