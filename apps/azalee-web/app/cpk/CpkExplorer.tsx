"use client";

/**
 * Explorateur /cpk — file manager **Material 3 / style Google Drive**, deux panneaux :
 *
 *   ┌─ nav rail : arbre virtualisé lazy (CpkTree) ─┬─ panneau détail : preview du fichier ─┐
 *   │ surface container                            │ surface                               │
 *
 * Layout canonical M3 *list-detail* (m3.material.io) ; tient les 250 800 fichiers grâce à la
 * virtualisation + au chargement lazy par dossier. L'URL est synchronisée (`/cpk/<path>`) sans
 * rechargement (deep-link partageable). Le panneau détail réutilise `CpkFilePreview` (viewers
 * wasm natifs : texture/modèle/audio/vidéo).
 */
import { useCallback, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { CpkFilePreview } from "@/app/cpk/CpkFilePreview";
import { CpkTree } from "@/app/cpk/CpkTree";
import { cpkAssetKind, cpkAssetUrl, segLabel } from "@/lib/cpk/shared";
import type { CpkNode } from "@/lib/cpk/tree";

/** Fil d'Ariane M3 (text buttons) reconstruit depuis un chemin d'index `data/...`. */
function Breadcrumb({ path }: { path: string }) {
	const segs = path.replace(/^data\/?/, "").split("/").filter(Boolean);
	return (
		<nav className="flex items-center gap-0.5 text-sm text-on-surface-variant overflow-x-auto">
			<Link href="/cpk" className="px-2 py-1 rounded-full hover:bg-on-surface/[0.08] shrink-0">
				CPK
			</Link>
			{segs.map((s, i) => (
				<span key={i} className="flex items-center gap-0.5 shrink-0">
					<Icon name="chevron_right" size={16} className="text-on-surface-variant/50" />
					<Link
						href={`/cpk/${segs.slice(0, i + 1).join("/")}`}
						className={`px-2 py-1 rounded-full hover:bg-on-surface/[0.08] ${
							i === segs.length - 1 ? "text-on-surface font-medium" : ""
						}`}
					>
						{segLabel(s)}
					</Link>
				</span>
			))}
		</nav>
	);
}

export function CpkExplorer({ initialPath }: { initialPath?: string }) {
	const initialFile = initialPath && initialPath !== "data" && /\.[a-z0-9]+$/i.test(initialPath);
	const [selected, setSelected] = useState<CpkNode | null>(
		initialFile
			? {
					id: initialPath,
					name: initialPath.split("/").pop() ?? initialPath,
					kind: "file",
					ext: initialPath.split(".").pop() ?? "",
				}
			: null,
	);

	const onSelectFile = useCallback((node: CpkNode) => {
		setSelected(node);
		// Sync URL sans reload (deep-link partageable).
		const rel = node.id.replace(/^data\/?/, "");
		window.history.replaceState(null, "", `/cpk/${rel}`);
	}, []);

	const onSelectDir = useCallback((node: CpkNode) => {
		const rel = node.id.replace(/^data\/?/, "");
		window.history.replaceState(null, "", `/cpk/${rel}`);
	}, []);

	return (
		<div className="flex h-[calc(100vh-9rem)] min-h-[32rem] rounded-3xl border border-outline-variant/20 overflow-hidden bg-surface">
			{/* Nav rail : arbre */}
			<aside className="w-72 lg:w-80 shrink-0 bg-surface-container border-r border-outline-variant/20 flex flex-col">
				<div className="px-4 py-3 border-b border-outline-variant/20 flex items-center gap-2">
					<Icon name="folder_open" size={18} className="text-primary" />
					<span className="text-sm font-semibold text-on-surface">Fichiers CPK</span>
				</div>
				<div className="flex-1 min-h-0 p-1.5">
					<CpkTree
						initialPath={initialPath}
						onSelectFile={onSelectFile}
						onSelectDir={onSelectDir}
					/>
				</div>
			</aside>

			{/* Panneau détail */}
			<section className="flex-1 min-w-0 flex flex-col">
				<header className="px-4 py-3 border-b border-outline-variant/20 bg-surface">
					<Breadcrumb path={selected?.id ?? initialPath ?? "data"} />
				</header>
				<div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
					{selected && selected.kind === "file" ? (
						<CpkFilePreview
							key={selected.id}
							name={selected.name}
							ext={selected.ext ?? ""}
							path={selected.id}
							kind={cpkAssetKind(selected.ext ?? "")}
							assetUrl={cpkAssetUrl(selected.id, selected.ext)}
						/>
					) : (
						<div className="h-full flex flex-col items-center justify-center text-center gap-3 text-on-surface-variant">
							<Icon name="touch_app" size={40} className="text-on-surface-variant/40" />
							<p className="text-sm max-w-xs">
								Parcourez l'arbre à gauche et sélectionnez un fichier pour le décoder et le
								prévisualiser (texture, modèle 3D, audio, vidéo, données).
							</p>
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
