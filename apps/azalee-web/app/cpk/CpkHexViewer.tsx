"use client";

/**
 * Visualiseur hexadécimal d'un fichier brut du CPK : `offset | 16 octets hex | ASCII`.
 * Récupère les octets décompressés via `/raw` (nie-model-serve) et n'affiche que les
 * premiers Ko (les CPK contiennent des binaires lourds — pas de dump intégral).
 */
import { useEffect, useState } from "react";

/** Nombre maximal d'octets affichés (16 octets/ligne). */
const MAX_BYTES = 16 * 256; // 4 Ko

export function CpkHexViewer({ url }: { url: string }) {
	const [bytes, setBytes] = useState<Uint8Array | null>(null);
	const [total, setTotal] = useState<number | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setBytes(null);
		setError(false);
		fetch(url)
			.then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
			.then((buf) => {
				if (cancelled) return;
				const full = new Uint8Array(buf);
				setTotal(full.byteLength);
				setBytes(full.subarray(0, MAX_BYTES));
			})
			.catch(() => !cancelled && setError(true));
		return () => {
			cancelled = true;
		};
	}, [url]);

	if (error) {
		return (
			<div className="p-8 text-center text-sm text-on-surface-variant">
				Contenu binaire indisponible.
			</div>
		);
	}
	if (!bytes) {
		return (
			<div className="flex items-center justify-center p-10">
				<div className="animate-spin rounded-full size-6 border-b-2 border-primary" />
			</div>
		);
	}

	const lines: string[] = [];
	for (let off = 0; off < bytes.length; off += 16) {
		const slice = bytes.subarray(off, off + 16);
		const hex = Array.from(slice, (b) => b.toString(16).padStart(2, "0")).join(" ");
		const ascii = Array.from(slice, (b) =>
			b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."
		).join("");
		lines.push(`${off.toString(16).padStart(8, "0")}  ${hex.padEnd(47)}  ${ascii}`);
	}

	return (
		<div className="p-4">
			{total !== null && total > bytes.length && (
				<p className="text-xs text-on-surface-variant mb-2 font-mono">
					{bytes.length} premiers octets sur {total.toLocaleString("fr")} — télécharger l'original
					pour le tout.
				</p>
			)}
			<pre className="text-[11px] text-on-surface bg-surface-container-lowest rounded-xl p-3 overflow-auto max-h-[60vh] font-mono leading-tight whitespace-pre">
				{lines.join("\n")}
			</pre>
		</div>
	);
}
