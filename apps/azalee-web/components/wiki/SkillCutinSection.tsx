"use client";

/**
 * Section "Cut-in" d'une fiche hissatsu : affiche **tous** les assets du cut-in servis live par
 * niers — le **telop** (nom rendu, g4tx→png), le **modèle 3D** du cut-in (`chr/_waza`, assemblé
 * serveur depuis g4pkm→g4md + g4mg + texture g4tx embarquée), la **texture** (`dx11/chr/_waza`,
 * g4tx→png) et la liste des **effets d'event** (`common/event/<grp>/<ev>/`, g4pk). Données :
 * `skills-cutin.json` (+ `/api/cpk` pour le listing d'effets).
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cpkAssetUrl } from "@/lib/cpk/shared";
import type { SkillCutin } from "@/lib/skills-cutin";

const CharacterModelViewer = dynamic(() => import("@/components/wiki/CharacterModelViewer"), {
	ssr: false,
});

const CDN = "https://cdn.rosegriffon.fr";

/** Liste des effets g4pk d'un event de cut-in (via l'API d'index CPK). */
function CutinEffects({ dir }: { dir: string }) {
	const [files, setFiles] = useState<string[] | null>(null);
	useEffect(() => {
		let on = true;
		fetch(`/api/cpk?path=${encodeURIComponent(dir.replace(/\/$/, ""))}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((j) => {
				if (on && j?.files) setFiles(j.files.map((f: { name: string }) => f.name));
			})
			.catch(() => on && setFiles([]));
		return () => {
			on = false;
		};
	}, [dir]);

	if (!files) return null;
	const g4pk = files.filter((f) => f.endsWith(".g4pk"));
	return (
		<details className="text-xs">
			<summary className="cursor-pointer text-on-surface-variant hover:text-on-surface">
				Effets d'event ({g4pk.length} g4pk · {files.length} fichiers)
			</summary>
			<ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 font-mono text-on-surface-variant/80 max-h-60 overflow-y-auto">
				{files.map((f) => (
					<li key={f} className="truncate">
						{f}
					</li>
				))}
			</ul>
		</details>
	);
}

export function SkillCutinSection({ cutin, skillName }: { cutin: SkillCutin; skillName: string }) {
	// Telop préféré : fr puis en puis 1re langue dispo (g4tx→png via le CDN /dx11).
	const telopPath =
		cutin.telop_by_lang.find(([l]) => l === "fr")?.[1] ??
		cutin.telop_by_lang.find(([l]) => l === "en")?.[1] ??
		cutin.telop_by_lang[0]?.[1];
	const telopUrl = telopPath ? cpkAssetUrl(telopPath) : null;
	// Modèle assemblé serveur (g4pkm→g4md + g4mg + texture) ; bien plus fiable qu'in-browser.
	const modelUrl = `${CDN}/model-chr/waza/${cutin.event_id_name}.glb`;
	const textureUrl = cpkAssetUrl(cutin.texture_g4tx);

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
					<img src={telopUrl} alt={`Telop ${skillName}`} loading="lazy" className="max-h-24 w-auto" />
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<p className="text-xs text-on-surface-variant mb-1">
						Modèle 3D du cut-in (chr/_waza, texturé)
					</p>
					<CharacterModelViewer glbUrl={modelUrl} name={skillName} inline />
				</div>
				{textureUrl && (
					<div>
						<p className="text-xs text-on-surface-variant mb-1">Texture (dx11/chr/_waza)</p>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={textureUrl}
							alt={`Texture ${skillName}`}
							loading="lazy"
							className="w-full max-w-xs rounded-lg bg-surface-container [image-rendering:pixelated]"
						/>
					</div>
				)}
			</div>

			<CutinEffects dir={cutin.effects_dir} />

			<details className="text-xs text-on-surface-variant">
				<summary className="cursor-pointer hover:text-on-surface">Chemins des assets</summary>
				<div className="mt-2 space-y-1 font-mono break-all">
					<p>modèle : {cutin.model_g4mg}</p>
					<p>texture : {cutin.texture_g4tx}</p>
					<p>son : {cutin.sound_cfg}</p>
					<p>effets : {cutin.effects_dir}</p>
					<p>telop : {cutin.telop_by_lang.map(([l]) => l).join(", ")}</p>
				</div>
			</details>
		</section>
	);
}
