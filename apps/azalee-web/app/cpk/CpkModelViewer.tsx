"use client";

/**
 * Viewer de modèle 3D `.g4md`/`.g4mg` **assemblé nativement dans le navigateur** : récupère
 * la paire G4MD + G4MG (octets bruts via `/raw`) et l'assemble en GLB via wasm (`modelToGlb`,
 * mêmes parseurs Rust que le jeu), affiché dans `<model-viewer>` via un blob URL.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cpkRawUrl } from "@/lib/cpk/shared";
import { modelToGlb } from "@/lib/cpk-wasm";

const CharacterModelViewer = dynamic(() => import("@/components/wiki/CharacterModelViewer"), {
	ssr: false,
});

export function CpkModelViewer({ path, name }: { path: string; name: string }) {
	const [url, setUrl] = useState<string | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		let objectUrl: string | null = null;
		setUrl(null);
		setError(false);

		(async () => {
			try {
				// Paire G4MD (descripteur) + G4MG (géométrie) — chemins siblings.
				const mdPath = path.replace(/\.g4mg$/i, ".g4md");
				const mgPath = mdPath.replace(/\.g4md$/i, ".g4mg");
				const [mdRes, mgRes] = await Promise.all([
					fetch(cpkRawUrl(mdPath)),
					fetch(cpkRawUrl(mgPath)),
				]);
				if (!mdRes.ok || !mgRes.ok) throw new Error("paire g4md/g4mg introuvable");
				const md = new Uint8Array(await mdRes.arrayBuffer());
				const mg = new Uint8Array(await mgRes.arrayBuffer());
				const glb = await modelToGlb(md, mg);
				if (cancelled) return;
				objectUrl = URL.createObjectURL(new Blob([glb.slice()], { type: "model/gltf-binary" }));
				setUrl(objectUrl);
			} catch {
				if (!cancelled) setError(true);
			}
		})();

		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [path]);

	if (error) {
		return (
			<div className="flex flex-col items-center gap-2 p-8 text-center">
				<Icon name="deployed_code" size={32} className="text-on-surface-variant/50" />
				<p className="text-sm text-on-surface-variant">
					Modèle non assemblable in-browser (paire G4MD/G4MG manquante ou incompatible).
				</p>
			</div>
		);
	}
	if (!url) {
		return (
			<div className="flex items-center justify-center p-10">
				<div className="animate-spin rounded-full size-7 border-b-2 border-primary" />
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-2 p-4">
			<p className="text-xs text-on-surface-variant">
				Modèle 3D assemblé in-browser (G4MD + G4MG → GLB, wasm)
			</p>
			<CharacterModelViewer glbUrl={url} name={name} />
			<a
				href={url}
				download={`${name}.glb`}
				className="text-xs text-primary hover:underline inline-flex items-center gap-1"
			>
				<Icon name="download" size={14} /> Télécharger le GLB
			</a>
		</div>
	);
}
