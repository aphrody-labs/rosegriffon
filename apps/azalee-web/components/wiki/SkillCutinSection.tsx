"use client";

/**
 * Section "Cut-in" d'une fiche hissatsu : affiche **tous** les assets du cut-in servis live par
 * niers — le **telop** (nom rendu, g4tx→png), le **modèle 3D** du cut-in (`chr/_waza`, assemblé
 * serveur depuis g4pkm→g4md + g4mg + texture g4tx embarquée), la **texture** (`dx11/chr/_waza`,
 * g4tx→png) et la liste des **effets d'event** (`common/event/<grp>/<ev>/`, g4pk). Données :
 * `skills-cutin.json` (+ `/api/cpk` pour le listing d'effets).
 */
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
// Viewer cut-in composé (scène R3F + timeline + export MP4). C'est lui qui gère le
// `next/dynamic { ssr:false }` de la scène et le repli `<CharacterModelViewer>` interne.
import { CutinViewer } from "@/components/wiki/cutin/CutinViewer";
import { cpkAssetUrl } from "@/lib/cpk/shared";
import type { SkillCutin } from "@/lib/skills-cutin";

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

/** Chip de téléchargement (texture/telop PNG), réutilisable. */
function DownloadChip({ href, filename }: { href: string; filename: string }) {
	return (
		<a
			href={href}
			download={filename}
			className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors"
			title="Télécharger (PNG)"
		>
			<Icon name="download" size={12} /> PNG
		</a>
	);
}

export function SkillCutinSection({
	cutin,
	skillName,
	assetsAvailable,
}: {
	cutin: SkillCutin;
	skillName: string;
	/** Le modèle 3D + la texture `_waza` existent dans cette build (vérifié serveur via l'index
	    CPK) : ~157/992 hissatsu. Faux → on n'affiche ni le viewer ni la texture (sinon 404/broken). */
	assetsAvailable: boolean;
}) {
	const [telopError, setTelopError] = useState(false);
	// Telop préféré : fr puis en puis 1re langue dispo (g4tx→png via le CDN /dx11).
	const telopPath =
		cutin.telop_by_lang.find(([l]) => l === "fr")?.[1] ??
		cutin.telop_by_lang.find(([l]) => l === "en")?.[1] ??
		cutin.telop_by_lang[0]?.[1];
	const telopUrl = telopPath ? cpkAssetUrl(telopPath) : null;
	const textureUrl = cpkAssetUrl(cutin.texture_g4tx);

	return (
		<section className="rounded-3xl border border-outline-variant/20 bg-surface-container-low/40 p-5 space-y-4">
			<h2 className="flex items-center gap-2 text-fluid-title-md font-bold text-on-surface">
				<Icon name="auto_awesome" size={20} className="text-primary" />
				Cut-in{" "}
				<span className="text-xs font-mono text-on-surface-variant">({cutin.event_id_name})</span>
			</h2>

			{telopUrl && !telopError && (
				<div>
					<div className="flex items-center justify-between mb-1">
						<p className="text-xs text-on-surface-variant">Telop (nom rendu)</p>
						<DownloadChip href={telopUrl} filename={`${cutin.event_id_name}_telop.png`} />
					</div>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={telopUrl}
						alt={`Telop ${skillName}`}
						loading="lazy"
						className="max-h-24 w-auto"
						onError={() => setTelopError(true)}
					/>
				</div>
			)}

			{/* Scène cut-in composée + texture : affichées UNIQUEMENT si l'asset `_waza` existe dans
			    cette build (gate serveur `assetsAvailable`). Sinon (835/992 hissatsu sans cut-in 3D),
			    on évite un viewer « indisponible » + une image cassée. Le viewer gère lui-même le
			    chargement lazy de la scène R3F + le repli model-viewer. */}
			{assetsAvailable && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<p className="text-xs text-on-surface-variant mb-1">
							Scène cut-in (modèle 3D composé · timeline · export MP4)
						</p>
						<CutinViewer cutin={cutin} skillName={skillName} />
					</div>
					{textureUrl && (
						<div>
							<div className="flex items-center justify-between mb-1">
								<p className="text-xs text-on-surface-variant">Texture (dx11/chr/_waza)</p>
								<DownloadChip href={textureUrl} filename={`${cutin.event_id_name}.png`} />
							</div>
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
			)}

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
