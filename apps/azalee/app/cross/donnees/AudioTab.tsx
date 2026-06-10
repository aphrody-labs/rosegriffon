import React from "react";
import Link from "next/link";

interface AudioTabProps {
	audioJson: {
		characters: Record<string, string[]>;
		total_wav: number;
	};
	characterNames: Record<string, string>;
	selectedChar: string;
	filteredLines: string[];
	q: string;
	dev: boolean;
}

export function AudioTab({
	audioJson,
	characterNames,
	selectedChar,
	filteredLines,
	q,
	dev,
}: AudioTabProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
			{/* Sélecteur de personnage */}
			<div className="space-y-3">
				<h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant/70">
					Personnages ({Object.keys(audioJson.characters).length})
				</h3>
				<div className="flex flex-col gap-2">
					{Object.keys(audioJson.characters).map((charId) => {
						const active = selectedChar === charId;
						const name = characterNames[charId] || charId;
						const count = audioJson.characters[charId]?.length ?? 0;
						return (
							<Link
								key={charId}
								href={`/cross/donnees?tab=audio&char=${charId}${q ? `&q=${q}` : ""}${dev ? "&dev=true" : ""}`}
								className={`flex items-center justify-between rounded-xl px-4 py-3 border text-sm font-semibold transition-all ${
									active
										? "bg-[#00aeef] text-white border-[#00aeef] shadow-sm"
										: "bg-surface-container hover:bg-surface-container-high border-outline-variant/30 text-on-surface"
								}`}
							>
								<span>{name}</span>
								<span className={`text-xs rounded-full px-2 py-0.5 ${active ? "bg-white/25 text-white" : "bg-surface-container-highest text-on-surface-variant"}`}>
									{count} clips
								</span>
							</Link>
						);
					})}
				</div>
			</div>

			{/* Liste des clips audio */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-black text-on-surface">
						Clips audio pour {characterNames[selectedChar] || selectedChar}
						{q && (
							<span className="text-on-surface-variant font-normal ml-2">
								({filteredLines.length} trouvés)
							</span>
						)}
					</h3>
				</div>

				{filteredLines.length === 0 ? (
					<div className="rounded-2xl bg-surface-container p-8 text-center border border-outline-variant/30 text-on-surface-variant">
						Aucun clip audio ne correspond à votre recherche.
					</div>
				) : (
					<div className="grid grid-cols-1 gap-3">
						{filteredLines.map((line) => {
							const fileName = `${selectedChar}_${line}.wav`;
							const audioUrl = `/inazuma-cross/audio/${fileName}`;
							// Nettoyer le nom de la ligne (enlever le préfixe numérique et remplacer les points-virgules)
							const cleanLabel = line.replace(/^\d+_c\d+_(.+)$/, "$1").replace(/_/g, " ").replace(/;/g, " /");
							return (
								<div
									key={line}
									className="rounded-2xl bg-surface-container p-4 border border-outline-variant/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
								>
									<div className="space-y-1">
										<div className="font-bold text-on-surface text-sm capitalize">{cleanLabel}</div>
										{dev && (
											<div className="font-mono text-[10px] text-on-surface-variant/75 truncate max-w-lg" title={fileName}>
												{fileName}
											</div>
										)}
									</div>
									<div className="shrink-0 flex items-center gap-2">
										<audio src={audioUrl} controls className="h-9 max-w-[240px] sm:max-w-none" />
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
