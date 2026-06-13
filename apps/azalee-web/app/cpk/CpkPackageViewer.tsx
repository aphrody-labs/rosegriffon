"use client";

/**
 * Viewer d'archive `.g4pk` (paquet Level-5 de sous-fichiers) décodé **in-browser** :
 * récupère les octets bruts (`/raw`) et liste les sous-fichiers (nom, taille) via wasm
 * (`g4pkParse`). Remplace le dump hex pour les ~45 000 fichiers g4pk de l'explorateur.
 */
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cpkRawUrl } from "@/lib/cpk/shared";
import { g4pkParse, type G4pkParsed } from "@/lib/cpk-wasm";

function humanSize(n: number): string {
	if (n < 1024) return `${n} o`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
	return `${(n / (1024 * 1024)).toFixed(2)} Mo`;
}

export function CpkPackageViewer({ path }: { path: string }) {
	const [pkg, setPkg] = useState<G4pkParsed | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setPkg(null);
		setError(false);
		(async () => {
			try {
				const res = await fetch(cpkRawUrl(path));
				if (!res.ok) throw new Error(String(res.status));
				const parsed = await g4pkParse(new Uint8Array(await res.arrayBuffer()));
				if (!cancelled) setPkg(parsed);
			} catch {
				if (!cancelled) setError(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [path]);

	if (error) {
		return (
			<div className="flex flex-col items-center gap-2 p-10 text-center">
				<Icon name="inventory_2" size={40} className="text-on-surface-variant/40" />
				<p className="text-sm text-on-surface-variant">
					Archive non décodable — téléchargez l'original.
				</p>
			</div>
		);
	}
	if (!pkg) {
		return (
			<div className="flex items-center justify-center p-10">
				<div className="animate-spin rounded-full size-7 border-b-2 border-primary" />
			</div>
		);
	}

	return (
		<div className="p-4">
			<p className="mb-2 text-xs text-on-surface-variant font-mono">
				<Icon name="inventory_2" size={14} className="inline align-text-bottom mr-1" />
				archive G4PK · {pkg.files.length} sous-fichiers · décodé in-browser
			</p>
			<div className="overflow-auto max-h-[60vh] rounded-xl border border-outline-variant/20">
				<table className="w-full text-xs">
					<thead className="sticky top-0 bg-surface-container-high text-on-surface-variant">
						<tr>
							<th className="text-left font-semibold px-3 py-2">#</th>
							<th className="text-left font-semibold px-3 py-2">Nom</th>
							<th className="text-right font-semibold px-3 py-2">Taille</th>
						</tr>
					</thead>
					<tbody className="font-mono">
						{pkg.files.map((f, i) => (
							<tr
								key={`${f.name}-${i}`}
								className="border-t border-outline-variant/10 hover:bg-surface-container-low"
							>
								<td className="px-3 py-1.5 text-on-surface-variant/60">{i}</td>
								<td className="px-3 py-1.5 text-on-surface break-all">{f.name || "(sans nom)"}</td>
								<td className="px-3 py-1.5 text-right text-on-surface-variant tabular-nums">
									{humanSize(f.size)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
