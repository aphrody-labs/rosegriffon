"use client";

/**
 * Viewer de texture `.g4tx` décodée **nativement dans le navigateur** : récupère les
 * octets bruts (`/raw`) et les décode en PNG via wasm (`g4txToPng` — DDS BC1/BC3/BC5/BC7
 * → RGBA → PNG, mêmes parseurs Rust que le jeu), affiché via un blob URL. Repli sur le
 * décodage CDN serveur (`/dx11`) si le wasm échoue.
 */
import { useEffect, useState } from "react";
import { cpkRawUrl } from "@/lib/cpk/shared";
import { g4txToPng } from "@/lib/cpk-wasm";

export interface CpkImageViewerProps {
	/** Chemin d'index du `.g4tx` (préfixe `data/`). */
	path: string;
	/** Nom du fichier (alt). */
	name: string;
	/** URL CDN de repli (décodage serveur) si le wasm échoue. */
	fallbackUrl: string | null;
}

export function CpkImageViewer({ path, name, fallbackUrl }: CpkImageViewerProps) {
	const [url, setUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		let objectUrl: string | null = null;
		setUrl(null);
		setFailed(false);

		(async () => {
			try {
				const res = await fetch(cpkRawUrl(path));
				if (!res.ok) throw new Error(String(res.status));
				const bytes = new Uint8Array(await res.arrayBuffer());
				const png = await g4txToPng(bytes);
				if (cancelled) return;
				// Copie dans un ArrayBuffer net pour le Blob (évite les vues partagées wasm).
				objectUrl = URL.createObjectURL(new Blob([png.slice()], { type: "image/png" }));
				setUrl(objectUrl);
			} catch {
				if (!cancelled) setFailed(true);
			}
		})();

		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [path]);

	// Repli serveur (/dx11) si le décodage in-browser échoue.
	if (failed && fallbackUrl) {
		return (
			<a
				href={fallbackUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="block bg-surface-container-high"
			>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={fallbackUrl}
					alt={name}
					loading="lazy"
					className="mx-auto max-h-[60vh] w-auto object-contain p-4"
				/>
			</a>
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
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			className="block bg-surface-container-high"
		>
			{/* PNG décodé in-browser (wasm) → blob URL. */}
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={url} alt={name} className="mx-auto max-h-[60vh] w-auto object-contain p-4" />
		</a>
	);
}
