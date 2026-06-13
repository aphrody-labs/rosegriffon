"use client";

/**
 * Vue du contenu d'un dossier CPK — **grille** (elevated cards M3 12dp, thumbnails) ou **liste**
 * (M3 list items), avec **tri** (nom / type). Sous-dossiers + fichiers du dossier courant, fetchés
 * via `/api/cpk?path=`. Clic dossier → navigation ; clic fichier → preview. Rendu borné
 * (`CAP`) + « afficher plus » pour les dossiers volumineux (jusqu'à ~15k fichiers directs).
 */
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cpkPreviewKind, cpkThumbUrl } from "@/lib/cpk/shared";

const CAP = 300;

interface Item {
	id: string;
	name: string;
	kind: "dir" | "file";
	ext?: string;
	count?: number;
}

function itemIcon(it: Item): string {
	if (it.kind === "dir") return "folder";
	switch (cpkPreviewKind(it.ext ?? "")) {
		case "image":
			return "image";
		case "model":
			return "deployed_code";
		case "sound":
			return "music_note";
		case "movie":
			return "movie";
		case "config":
		case "package":
			return "data_object";
		case "text":
			return "description";
		default:
			return "draft";
	}
}

export function CpkFolderView({
	dir,
	view,
	sort,
	onOpenDir,
	onOpenFile,
}: {
	dir: string;
	view: "grid" | "list";
	sort: "name" | "type";
	onOpenDir: (id: string) => void;
	onOpenFile: (id: string, ext: string, name: string) => void;
}) {
	const [items, setItems] = useState<Item[] | null>(null);
	const [limit, setLimit] = useState(CAP);

	useEffect(() => {
		let on = true;
		setItems(null);
		setLimit(CAP);
		fetch(`/api/cpk?path=${encodeURIComponent(dir)}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((j) => {
				if (!on || !j) return;
				const dirs: Item[] = (j.dirs ?? []).map((d: { name: string; count: number }) => ({
					id: `${dir}/${d.name}`,
					name: d.name,
					kind: "dir" as const,
					count: d.count,
				}));
				const files: Item[] = (j.files ?? []).map(
					(f: { name: string; ext: string; path: string }) => ({
						id: f.path,
						name: f.name,
						kind: "file" as const,
						ext: f.ext,
					}),
				);
				setItems([...dirs, ...files]);
			})
			.catch(() => on && setItems([]));
		return () => {
			on = false;
		};
	}, [dir]);

	const sorted = useMemo(() => {
		if (!items) return [];
		const arr = [...items];
		arr.sort((a, b) => {
			// Dossiers d'abord, toujours.
			if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
			if (sort === "type" && a.kind === "file") {
				const e = (a.ext ?? "").localeCompare(b.ext ?? "");
				if (e !== 0) return e;
			}
			return a.name.localeCompare(b.name, "fr", { numeric: true });
		});
		return arr;
	}, [items, sort]);

	if (items === null) {
		return (
			<div className="flex items-center justify-center p-12">
				<div className="animate-spin rounded-full size-7 border-b-2 border-primary" />
			</div>
		);
	}
	if (items.length === 0) {
		return <p className="p-8 text-center text-sm text-on-surface-variant">Dossier vide.</p>;
	}

	const shown = sorted.slice(0, limit);
	const open = (it: Item) =>
		it.kind === "dir" ? onOpenDir(it.id) : onOpenFile(it.id, it.ext ?? "", it.name);

	return (
		<div className="space-y-4">
			{view === "grid" ? (
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
					{shown.map((it) => {
						const thumb = it.kind === "file" ? cpkThumbUrl(it.id, it.ext, 240) : null;
						return (
							<button
								key={it.id}
								type="button"
								onClick={() => open(it)}
								className="group flex flex-col rounded-xl bg-surface-container-low border border-outline-variant/15 overflow-hidden text-left hover:bg-surface-container transition-colors focus-visible:ring-2 focus-visible:ring-primary"
							>
								<div className="aspect-square flex items-center justify-center bg-surface-container/50 overflow-hidden">
									{thumb ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img
											src={thumb}
											alt={it.name}
											loading="lazy"
											className="w-full h-full object-contain [image-rendering:auto]"
										/>
									) : (
										<Icon
											name={itemIcon(it)}
											size={40}
											className={it.kind === "dir" ? "text-primary" : "text-on-surface-variant/60"}
										/>
									)}
								</div>
								<div className="p-2 min-w-0">
									<p className="truncate text-xs text-on-surface" title={it.name}>
										{it.name}
									</p>
									{it.kind === "dir" && typeof it.count === "number" && (
										<p className="text-[11px] text-on-surface-variant/70">
											{it.count.toLocaleString("fr")} fichiers
										</p>
									)}
								</div>
							</button>
						);
					})}
				</div>
			) : (
				<ul className="divide-y divide-outline-variant/10">
					{shown.map((it) => (
						<li key={it.id}>
							<button
								type="button"
								onClick={() => open(it)}
								className="w-full flex items-center gap-3 h-12 px-2 rounded-lg text-left hover:bg-on-surface/[0.08] transition-colors"
							>
								<Icon
									name={itemIcon(it)}
									size={20}
									className={`shrink-0 ${it.kind === "dir" ? "text-primary" : "text-on-surface-variant"}`}
								/>
								<span className="truncate flex-1 text-sm text-on-surface">{it.name}</span>
								{it.kind === "dir" ? (
									<span className="text-xs text-on-surface-variant/70">
										{(it.count ?? 0).toLocaleString("fr")}
									</span>
								) : (
									<span className="text-xs font-mono text-on-surface-variant/60">.{it.ext}</span>
								)}
							</button>
						</li>
					))}
				</ul>
			)}

			{sorted.length > limit && (
				<div className="text-center">
					<button
						type="button"
						onClick={() => setLimit((l) => l + CAP)}
						className="h-9 px-4 rounded-full bg-surface-container-high text-on-surface text-sm hover:bg-surface-container-highest transition-colors"
					>
						Afficher plus ({(sorted.length - limit).toLocaleString("fr")} restants)
					</button>
				</div>
			)}
		</div>
	);
}
