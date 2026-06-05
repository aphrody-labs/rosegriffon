"use client";

import { Box, Shield, Swords } from "lucide-react";
import { useState } from "react";
import CharacterModelViewer from "@/components/wiki/CharacterModelViewer";
import { cn } from "@/lib/utils";

interface ModelEntry {
	code: string;
	name: string;
	glbUrl: string;
}

interface KeshinModelGalleryProps {
	keshin: ModelEntry[];
	armures: ModelEntry[];
}

type Tab = "keshin" | "armures";

function ModelCard({ entry }: { entry: ModelEntry }) {
	return (
		<div className="group flex items-center gap-3 p-3 rounded-2xl bg-surface-container border border-outline-variant/20 hover:border-primary/40 hover:bg-surface-container-high transition-all duration-200">
			<div className="size-12 rounded-xl bg-surface-container-highest flex items-center justify-center shrink-0 text-primary">
				<Box size={22} aria-hidden="true" />
			</div>
			<div className="flex-1 min-w-0">
				<p className="type-title-small text-on-surface truncate">{entry.name}</p>
				<p className="type-body-small text-on-surface-variant/60 font-mono">{entry.code}</p>
			</div>
			{/* Réutilise le viewer dialog (lazy <model-viewer> au clic) — anti-surcharge :
			    on ne monte pas 94 canvases d'un coup. */}
			<div className="shrink-0 rounded-full bg-surface-container-highest/60 border border-outline-variant/20">
				<CharacterModelViewer glbUrl={entry.glbUrl} name={entry.name} />
			</div>
		</div>
	);
}

export function KeshinModelGallery({ keshin, armures }: KeshinModelGalleryProps) {
	const [tab, setTab] = useState<Tab>(keshin.length > 0 ? "keshin" : "armures");
	const entries = tab === "keshin" ? keshin : armures;

	const TABS: Array<{ id: Tab; label: string; count: number; icon: typeof Swords }> = [
		{ count: keshin.length, icon: Swords, id: "keshin", label: "Esprits Guerriers" },
		{ count: armures.length, icon: Shield, id: "armures", label: "Armures" },
	];

	return (
		<div className="space-y-6">
			{/* Onglets */}
			<div className="flex flex-wrap gap-2">
				{TABS.map((t) => {
					const TabIcon = t.icon;
					return (
						<button
							key={t.id}
							type="button"
							onClick={() => setTab(t.id)}
							disabled={t.count === 0}
							className={cn(
								"flex items-center gap-2 px-4 py-2 rounded-full border transition-all",
								tab === t.id
									? "bg-primary text-on-primary border-primary"
									: "bg-surface-container border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high",
								t.count === 0 && "opacity-40 cursor-not-allowed"
							)}
						>
							<TabIcon size={16} aria-hidden="true" />
							<span className="type-label-large font-bold">{t.label}</span>
							<span className="type-label-small opacity-70">{t.count}</span>
						</button>
					);
				})}
			</div>

			{entries.length === 0 ? (
				<p className="type-body-medium text-on-surface-variant py-8 text-center">
					Aucun modèle 3D disponible pour le moment.
				</p>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{entries.map((entry) => (
						<ModelCard key={entry.code} entry={entry} />
					))}
				</div>
			)}
		</div>
	);
}
