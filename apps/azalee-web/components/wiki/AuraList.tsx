"use client";

import { CircleDot } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { AuraCard } from "@/components/wiki/AuraCard";
import { WikiPagination } from "@/components/wiki/WikiPagination";
import { WikiSearchToolbar } from "@/components/wiki/WikiSearchToolbar";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { translatePassiveEffect } from "@rosegriffon/azalee/text/aura-translations";
import { normalizeText } from "@rosegriffon/azalee/search/utils";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 48;

const ELEMENTS = [
	{ icon: "blur_on", label: "Tous", value: "" },
	{ commonSprite: "fire" as SpriteCommonKey, label: "Feu", value: "Fire" },
	{ commonSprite: "wind" as SpriteCommonKey, label: "Vent", value: "Wind" },
	{ commonSprite: "forest" as SpriteCommonKey, label: "Forêt", value: "Forest" },
	{ commonSprite: "mountain" as SpriteCommonKey, label: "Montagne", value: "Mountain" },
	{ icon: "blur_on", label: "Néant", value: "Void" },
];

interface AuraItem {
	id: string;
	auraId: string;
	name: string;
	passive?: string;
	hissatsu_name?: string;
	element?: string;
	image_url?: string;
	type?: string;
	sheetData?: any;
	assetCode?: string;
}

export function AuraList({ auras, category }: { auras: AuraItem[]; category: string }) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const q = searchParams.get("q") || "";
	const element = searchParams.get("element") || "";
	const currentPage = Number.parseInt(searchParams.get("page") || "1", 10);

	const updateElement = useCallback(
		(value: string) => {
			const params = new URLSearchParams(searchParams.toString());
			const current = params.get("element") || "";

			if (current === value || value === "") {
				params.delete("element");
			} else {
				params.set("element", value);
			}

			params.delete("page");
			router.push(`/aura/${category}?${params.toString()}`);
		},
		[router, searchParams, category]
	);

	// Client-side filtering (server already filters, this is for instant re-filter)
	let filteredAuras = auras;

	if (element) {
		const target = element.toLowerCase();
		filteredAuras = filteredAuras.filter((a) => {
			const el = (a.element || "").toLowerCase();
			return el.includes(target);
		});
	}

	if (q) {
		const qNormalized = normalizeText(q);
		filteredAuras = filteredAuras.filter(
			(a) =>
				normalizeText(a.name || "").includes(qNormalized) ||
				normalizeText(a.passive || "").includes(qNormalized) ||
				normalizeText(a.hissatsu_name || "").includes(qNormalized)
		);
	}

	const totalItems = filteredAuras.length;
	const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
	const paginatedAuras = filteredAuras.slice(startIndex, startIndex + ITEMS_PER_PAGE);

	return (
		<div className="space-y-6">
			<div className="space-y-4">
				<WikiSearchToolbar placeholder="Rechercher..." showFilters={false} />

				{/* Element Chips - same style as SkillFilterBar */}
				<div className="flex flex-wrap gap-2">
					{ELEMENTS.map((f) => {
						const isActive =
							f.value === "" ? !element : element.toLowerCase() === f.value.toLowerCase();
						return (
							<button
								key={f.value}
								onClick={() => updateElement(f.value)}
								className={cn(
									"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
									"transition-all duration-200 border cursor-pointer",
									isActive
										? "bg-secondary text-on-secondary border-secondary shadow-sm"
										: "bg-surface-container-low hover:bg-surface-container border-outline-variant/20 text-on-surface-variant hover:text-on-surface"
								)}
							>
								{f.commonSprite ? (
									<CommonSpriteIcon name={f.commonSprite} scale={0.28} />
								) : f.icon === "blur_on" ? (
									<CircleDot size={18} aria-hidden="true" />
								) : null}
								<span>{f.label}</span>
							</button>
						);
					})}
				</div>
			</div>

			<div className="flex items-center justify-between text-xs font-medium text-on-surface-variant px-1 uppercase tracking-wider">
				<span>{totalItems.toLocaleString("fr-FR")} résultats</span>
				<span>
					Page {currentPage} sur {Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))}
				</span>
			</div>

			{paginatedAuras.length > 0 ? (
				<FadeInStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
					{paginatedAuras.map((aura) => {
						const sd = aura.sheetData || {};
						const passiveRaw = sd.passiveEffect;
						const passiveFr = passiveRaw ? translatePassiveEffect(passiveRaw) : undefined;
						const hissatsuName = sd.hissatsu?.name || aura.hissatsu_name;

						return (
							<FadeInItem key={aura.id} className="h-full">
								<AuraCard
									id={aura.id}
									name={aura.name || "Inconnu"}
									description={aura.passive}
									element={{ en: aura.element || undefined, fr: aura.element || undefined }}
									image={aura.image_url || undefined}
									assetCode={aura.assetCode || undefined}
									subType={aura.type || undefined}
									category={category}
									passiveEffect={passiveFr}
									hissatsuName={hissatsuName}
									className="h-full"
								/>
							</FadeInItem>
						);
					})}
				</FadeInStagger>
			) : (
				<div className="py-20 text-center rounded-[32px] border border-outline-variant bg-surface-container-low border-dashed">
					<p className="text-on-surface-variant italic">Aucun résultat trouvé.</p>
				</div>
			)}

			<WikiPagination
				totalItems={totalItems}
				itemsPerPage={ITEMS_PER_PAGE}
				currentPage={currentPage}
			/>
		</div>
	);
}
