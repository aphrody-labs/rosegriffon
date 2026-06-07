"use client";

/**
 * Fiche d'un fichier de l'index CPK : preview selon le type + métadonnées.
 *
 * Le CONTENU décodé est servi par le CDN (`cdn.rosegriffon.fr`) — ce composant
 * ne fait que référencer la bonne URL CDN selon la famille de preview :
 *   - `image`  → `<img>` (variante WebP via CDN, lien PNG plein).
 *   - `model`  → viewer 3D `<model-viewer>` (`/model-full/<code>.glb`) si le code
 *                est un perso/keshin/uniforme, sinon lien `/model/<code>.glb`.
 *   - `sound`  → balise `<audio>` (le CDN sert le flux décodé).
 *   - `movie`  → balise `<video>`.
 *   - `text`   → fetch + rendu `<pre>` (best-effort, le CDN sert le brut).
 *   - `config` / `raw` → métadonnées + lien de téléchargement CDN.
 *
 * ⚠ `"use client"` : importe UNIQUEMENT le `-shared` client-safe (types + URLs),
 * jamais la lib serveur `lib/cpk/index.ts` (sqlite/Node → casse le bundle).
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
	cpkAudioUrl,
	cpkCfgUrl,
	cpkPreviewKind,
	cpkRawUrl,
	cpkVideoUrl,
	modelFullCode,
	modelFullUrl,
	previewKindLabel,
	type CpkPreviewKind,
} from "@/lib/cpk/shared";

// Le viewer 3D (model-viewer) est purement client + lourd → import dynamique.
const CharacterModelViewer = dynamic(
	() => import("@/components/wiki/CharacterModelViewer"),
	{ ssr: false },
);

export interface CpkFilePreviewProps {
	name: string;
	ext: string;
	path: string;
	cpk: string;
	/** Famille de contenu CDN brute (image|model|raw) issue de la lib serveur. */
	kind: "image" | "model" | "raw";
	/** URL CDN du contenu décodé (ou null). */
	assetUrl: string | null;
	/** URL vignette WebP (images uniquement, ou null). */
	thumbUrl: string | null;
}

export function CpkFilePreview(props: CpkFilePreviewProps) {
	const { name, ext, path, cpk, assetUrl } = props;
	const previewKind: CpkPreviewKind = cpkPreviewKind(ext);

	return (
		<div className="space-y-6">
			<div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low overflow-hidden">
				<PreviewBody {...props} previewKind={previewKind} />
			</div>

			{/* Métadonnées du fichier */}
			<dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
				<MetaRow label="Type" value={previewKindLabel(previewKind)} />
				<MetaRow label="Extension" value={`.${ext}`} mono />
				<MetaRow label="Nom" value={name} mono />
				<MetaRow label="Archive CPK" value={cpk} mono truncate />
				<MetaRow label="Chemin" value={path} mono truncate full />
			</dl>

			{/* Liens CDN */}
			<div className="flex flex-wrap gap-2">
				{assetUrl && (
					<a
						href={assetUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition"
					>
						<Icon name="open_in_new" size={16} />
						Contenu décodé (CDN)
					</a>
				)}
				<a
					href={cpkRawUrl(path)}
					download
					className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-outline-variant/40 bg-surface-container-low text-on-surface text-sm font-semibold hover:border-primary transition"
				>
					<Icon name="download" size={16} />
					Télécharger l'original
				</a>
			</div>
		</div>
	);
}

function PreviewBody(
	props: CpkFilePreviewProps & { previewKind: CpkPreviewKind },
) {
	const { name, path, assetUrl, thumbUrl, previewKind } = props;

	if (previewKind === "image" && assetUrl) {
		return (
			<a
				href={assetUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="block bg-surface-container-high"
			>
				{/* CDN webp déjà optimisé → <img> brut (pas de quota Next/image). */}
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={thumbUrl ?? assetUrl}
					alt={name}
					loading="lazy"
					className="mx-auto max-h-[60vh] w-auto object-contain p-4"
				/>
			</a>
		);
	}

	if (previewKind === "model") {
		const code = modelFullCode(name);
		if (code) {
			return (
				<div className="flex flex-col items-center gap-3 p-6">
					<p className="text-sm text-on-surface-variant text-center">
						Modèle 3D assemblé (corps + visage + uniforme) servi live par le CDN.
					</p>
					<CharacterModelViewer glbUrl={modelFullUrl(code)} name={name} />
					<a
						href={modelFullUrl(code)}
						download
						className="text-xs text-primary hover:underline inline-flex items-center gap-1"
					>
						<Icon name="download" size={14} /> Télécharger le GLB
					</a>
				</div>
			);
		}
		return (
			<div className="flex flex-col items-center gap-2 p-8 text-center">
				<Icon name="blur_on" size={32} className="text-on-surface-variant/50" />
				<p className="text-sm text-on-surface-variant">
					Maillage 3D brut — pas d'assemblage complet pour ce code.
				</p>
				{assetUrl && (
					<a
						href={assetUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs text-primary hover:underline"
					>
						Ouvrir le GLB
					</a>
				)}
			</div>
		);
	}

	if (previewKind === "sound") {
		// Audio CRI (acb/awb/hca/adx) décodé en direct en WAV par nie-model-serve
		// (`/audio/`) → lisible nativement. `preload="none"` : le décodage (coûteux)
		// ne se déclenche qu'au clic sur lecture.
		return (
			<div className="flex flex-col items-center gap-3 p-8 text-center">
				<Icon name="graphic_eq" size={36} className="text-on-surface-variant/50" />
				<p className="text-xs text-on-surface-variant">Audio CRI décodé en direct (HCA/ADX → WAV)</p>
				{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
				<audio controls preload="none" className="w-full max-w-md" src={cpkAudioUrl(path)} />
			</div>
		);
	}

	if (previewKind === "movie") {
		// Vidéo USM (CRI Sofdec2) démuxée + remuxée en MP4 H.264 par nie-model-serve
		// (`/video/`) → lisible nativement. `preload="none"` : décodage au clic.
		return (
			<div className="flex flex-col items-center gap-3 p-6 text-center">
				<p className="text-xs text-on-surface-variant">Vidéo USM décodée en direct (Sofdec2 → MP4 H.264)</p>
				{/* eslint-disable-next-line jsx-a11y/media-has-caption */}
				<video controls preload="none" className="w-full max-w-2xl rounded-lg" src={cpkVideoUrl(path)} />
			</div>
		);
	}

	if (previewKind === "text") {
		return <TextPreview url={cpkRawUrl(path)} />;
	}

	if (previewKind === "config") {
		return <ConfigPreview url={cpkCfgUrl(path)} />;
	}

	// raw : pas de preview inline → métadonnées + téléchargement ci-dessous.
	return (
		<div className="flex flex-col items-center gap-2 p-10 text-center">
			<Icon name="description" size={40} className="text-on-surface-variant/40" />
			<p className="text-sm text-on-surface-variant">
				Aperçu inline non disponible — téléchargez l'original ci-dessous.
			</p>
		</div>
	);
}

/** Preview config : décode le cfg.bin/objbin en JSON natif (nie-model-serve /cfg). */
function ConfigPreview({ url }: { url: string }) {
	const [json, setJson] = useState<string | null>(null);
	const [summary, setSummary] = useState<string | null>(null);
	const [errored, setErrored] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setJson(null);
		setErrored(false);
		setSummary(null);
		fetch(url)
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then((data: unknown) => {
				if (cancelled) return;
				// Résumé : format + nb de listes/entrées.
				const d = data as { format?: string; lists?: unknown[]; entries?: unknown[] };
				const count = d.lists?.length ?? d.entries?.length ?? 0;
				setSummary(`${d.format ?? "cfg.bin"} · ${count} ${d.lists ? "listes" : "entrées"}`);
				setJson(JSON.stringify(data, null, 2));
			})
			.catch(() => !cancelled && setErrored(true));
		return () => {
			cancelled = true;
		};
	}, [url]);

	if (errored) {
		return (
			<div className="flex flex-col items-center gap-2 p-10 text-center">
				<Icon name="database" size={40} className="text-on-surface-variant/40" />
				<p className="text-sm text-on-surface-variant">
					Décodage indisponible — téléchargez l'original ci-dessous.
				</p>
			</div>
		);
	}
	if (json === null) {
		return (
			<div className="flex items-center justify-center p-10">
				<div className="animate-spin rounded-full size-7 border-b-2 border-primary" />
			</div>
		);
	}
	return (
		<div className="p-4">
			{summary && (
				<p className="text-xs text-on-surface-variant mb-2 font-mono">{summary}</p>
			)}
			<pre className="text-xs text-on-surface bg-surface-container-lowest rounded-xl p-3 overflow-auto max-h-[60vh] font-mono leading-relaxed">
				{json}
			</pre>
		</div>
	);
}

/** Preview texte best-effort : fetch le contenu brut et l'affiche en `<pre>`. */
function TextPreview({ url }: { url: string }) {
	const [content, setContent] = useState<string | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setContent(null);
		setError(false);
		fetch(url)
			.then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
			.then((t) => {
				if (!cancelled) setContent(t.slice(0, 50_000));
			})
			.catch(() => {
				if (!cancelled) setError(true);
			});
		return () => {
			cancelled = true;
		};
	}, [url]);

	if (error) {
		return (
			<div className="p-8 text-center text-sm text-on-surface-variant">
				Contenu texte indisponible.
			</div>
		);
	}
	if (content === null) {
		return (
			<div className="flex items-center justify-center p-10">
				<div className="animate-spin rounded-full size-6 border-b-2 border-primary" />
			</div>
		);
	}
	return (
		<pre className="max-h-[60vh] overflow-auto p-4 text-xs text-on-surface font-mono whitespace-pre-wrap break-words">
			{content}
		</pre>
	);
}

function MetaRow({
	label,
	value,
	mono = false,
	truncate = false,
	full = false,
}: {
	label: string;
	value: string;
	mono?: boolean;
	truncate?: boolean;
	full?: boolean;
}) {
	return (
		<div
			className={`rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 ${full ? "sm:col-span-2" : ""}`}
		>
			<dt className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
				{label}
			</dt>
			<dd
				className={`mt-0.5 text-on-surface ${mono ? "font-mono text-xs" : ""} ${truncate ? "truncate" : "break-words"}`}
				title={value}
			>
				{value}
			</dd>
		</div>
	);
}
