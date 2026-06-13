"use client";

/**
 * Section "Cut-in" d'une fiche hissatsu : affiche les assets du cut-in (déjà servis live par
 * niers) — le **telop** (nom rendu, g4tx→png), le **modèle 3D** du cut-in (g4md+g4mg assemblés
 * en GLB **dans le navigateur** via wasm), et les chemins son/effets. Données : `skills-cutin.json`.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cpkAssetUrl, cpkRawUrl } from "@/lib/cpk/shared";
import { modelToGlb } from "@/lib/cpk-wasm";
import type { SkillCutin } from "@/lib/skills-cutin";

const CharacterModelViewer = dynamic(() => import("@/components/wiki/CharacterModelViewer"), {
	ssr: false,
});

/** Charge le modèle 3D du cut-in (g4md+g4mg) assemblé in-browser → blob GLB → model-viewer. */
function CutinModel({ g4md, g4mg, name }: { g4md: string; g4mg: string; name: string }) {
	const [url, setUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		let objectUrl: string | null = null;
		setUrl(null);
		setFailed(false);
		(async () => {
			try {
				const [mdRes, mgRes] = await Promise.all([fetch(cpkRawUrl(g4md)), fetch(cpkRawUrl(g4mg))]);
				if (!mdRes.ok || !mgRes.ok) throw new Error("paire g4md/g4mg introuvable");
				const md = new Uint8Array(await mdRes.arrayBuffer());
				const mg = new Uint8Array(await mgRes.arrayBuffer());
				const glb = await modelToGlb(md, mg);
				if (cancelled) return;
				objectUrl = URL.createObjectURL(new Blob([glb.slice()], { type: "model/gltf-binary" }));
				setUrl(objectUrl);
			} catch {
				if (!cancelled) setFailed(true);
			}
		})();
		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [g4md, g4mg]);

	if (failed) return null;
	if (!url) {
		return (
			<div className="flex items-center justify-center p-6">
				<div className="animate-spin rounded-full size-6 border-b-2 border-primary" />
			</div>
		);
	}
	return <CharacterModelViewer glbUrl={url} name={name} />;
}

export function SkillCutinSection({ cutin, skillName }: { cutin: SkillCutin; skillName: string }) {
	// Telop préféré : fr puis en puis 1re langue dispo (g4tx→png via le CDN /dx11).
	const telopPath =
		cutin.telop_by_lang.find(([l]) => l === "fr")?.[1] ??
		cutin.telop_by_lang.find(([l]) => l === "en")?.[1] ??
		cutin.telop_by_lang[0]?.[1];
	const telopUrl = telopPath ? cpkAssetUrl(telopPath) : null;

	return (
		<section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low/40 p-5 space-y-4">
			<h2 className="flex items-center gap-2 text-fluid-title-md font-bold text-on-surface">
				<Icon name="auto_awesome" size={20} className="text-primary" />
				Cut-in{" "}
				<span className="text-xs font-mono text-on-surface-variant">({cutin.event_id_name})</span>
			</h2>

			{telopUrl && (
				<div>
					<p className="text-xs text-on-surface-variant mb-1">Telop (nom rendu)</p>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={telopUrl}
						alt={`Telop ${skillName}`}
						loading="lazy"
						className="max-h-24 w-auto"
					/>
				</div>
			)}

			<div>
				<p className="text-xs text-on-surface-variant mb-1">
					Modèle 3D du cut-in (assemblé in-browser)
				</p>
				<CutinModel g4md={cutin.model_g4md} g4mg={cutin.model_g4mg} name={skillName} />
			</div>

			<details className="text-xs text-on-surface-variant">
				<summary className="cursor-pointer hover:text-on-surface">Assets du cut-in</summary>
				<div className="mt-2 space-y-1 font-mono break-all">
					<p>texture : {cutin.texture_g4tx}</p>
					<p>son : {cutin.sound_cfg}</p>
					<p>effets : {cutin.effects_dir}</p>
					<p>telop : {cutin.telop_by_lang.map(([l]) => l).join(", ")}</p>
				</div>
			</details>
		</section>
	);
}
