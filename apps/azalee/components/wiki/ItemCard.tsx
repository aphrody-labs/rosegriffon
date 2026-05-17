"use client";

import { Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { getItemIconUrl, resolveAssetUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

export interface ItemCardProps {
	id: string;
	name: string;
	category: string;
	categoryLabel?: string;
	rarity?: number;
	internalCode?: string;
	icon?: string;
	price?: number | null;
	location?: string | null;
	stats?: Record<string, any> | null;
	className?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
	shoes: "steps",
	misanga: "wrist_band",
	accessory: "diamond",
	kizuna_link: "link",
	consume: "local_pharmacy",
	special_tactics: "strategy",
	special_skill: "auto_awesome",
	super_tactics: "military_tech",
	formation: "sports",
	emblem: "shield",
	costume: "apparel",
	fashion: "styler",
	title: "badge",
	craft_obj: "construction",
	animal: "pets",
	name_plate: "id_card",
	performance: "music_note",
	important: "priority_high",
	special: "star",
};

export function ItemCard({
	id,
	name,
	category,
	categoryLabel,
	rarity: _rarity,
	internalCode,
	icon,
	price: _price,
	location,
	stats,
	className,
}: ItemCardProps) {
	const imageSrc =
		resolveAssetUrl(icon) ||
		(internalCode ? getItemIconUrl(internalCode) : null);
	const [imgError, setImgError] = useState(false);
	const catIcon = CATEGORY_ICONS[category] || "backpack";

	// Filter numeric stats for standard items
	const statEntries = stats
		? Object.entries(stats).filter(([, v]) => typeof v === "number" && v > 0)
		: [];
	const topStat =
		statEntries.length > 0
			? statEntries.sort(([, a], [, b]) => b - a)[0]
			: null;

	// Tactic effects
	const isTactic = category === "special_tactics";
	const effects =
		isTactic && stats
			? [stats.effect1, stats.effect2, stats.effect3].filter(Boolean)
			: [];

	return (
		<Link
			href={isTactic ? `/tactic/${id}` : `/item/${id}`}
			className={cn(
				"block h-full transition-all duration-200 relative overflow-hidden group",
				"hover:shadow-lg hover:-translate-y-0.5",
				"border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container",
				"rounded-2xl",
				className,
			)}
		>
			<div className="p-4 flex gap-4">
				{/* Icon */}
				<div className="size-14 shrink-0 rounded-xl bg-surface-container-high flex items-center justify-center border border-outline-variant/20 overflow-hidden">
					{imageSrc && !imgError ? (
						<Image
							src={imageSrc}
							alt={name}
							width={48}
							height={48}
							className="object-contain size-11"
							unoptimized
							onError={() => setImgError(true)}
						/>
					) : (
						<Icon
							name={catIcon}
							size={24}
							className="text-on-surface-variant/30"
						/>
					)}
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<h3 className="font-bold text-sm text-on-surface leading-tight group-hover:text-primary transition-colors line-clamp-2">
						{name}
					</h3>

					{/* Meta chips */}
					<div className="flex flex-wrap items-center gap-1.5 mt-1.5">
						<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container-highest/50 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
							<Icon name={catIcon} size={12} />
							{categoryLabel || category}
						</span>

						{topStat && (
							<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-[10px] font-bold text-primary">
								{STAT_SHORT[topStat[0]] || topStat[0]} +{topStat[1]}
							</span>
						)}

						{/* Tactic Duration/Cooldown */}
						{isTactic && stats && (
							<>
								{stats.duration && (
									<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-tertiary/10 text-[10px] font-bold text-tertiary">
										⏱ {stats.duration}s
									</span>
								)}
								{stats.cooldown && (
									<span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-error/10 text-[10px] font-bold text-error">
										⏳ {stats.cooldown}s
									</span>
								)}
							</>
						)}
					</div>

					{/* Tactic Effects List */}
					{effects.length > 0 && (
						<div className="mt-2 space-y-1">
							{effects.slice(0, 2).map((eff, i) => (
								<p
									key={i}
									className="text-[10px] text-on-surface-variant leading-tight truncate"
									title={eff}
								>
									• {eff}
								</p>
							))}
						</div>
					)}

					{/* Bottom row: price + location (Hide for tactics if they have effects to save space, or show if space permits) */}
					{!isTactic && location && (
						<div className="flex items-center gap-3 mt-2 text-xs text-on-surface-variant">
							<span className="inline-flex items-center gap-0.5 truncate">
								<Store size={14} aria-hidden="true" />
								{LOCATION_FR[location] || location}
							</span>
						</div>
					)}

					{isTactic && location && (
						<div className="flex items-center gap-3 mt-2 text-xs text-on-surface-variant">
							<span className="inline-flex items-center gap-0.5 truncate">
								<Store size={14} aria-hidden="true" />
								{LOCATION_FR[location] || location}
							</span>
						</div>
					)}
				</div>
			</div>
		</Link>
	);
}

const STAT_SHORT: Record<string, string> = {
	kick: "TIR",
	control: "CTR",
	technique: "TEC",
	pressure: "PRE",
	physical: "PHY",
	agility: "AGI",
	intelligence: "INT",
};

const LOCATION_FR: Record<string, string> = {
	Chronicle: "Chronique",
	"G-Mart (Arcade Branch)": "G-Mart (Arcade)",
	"G-Mart (Odaiba)": "G-Mart (Odaiba)",
	"Kool Kit (Odaiba Branch)": "Kool Kit (Odaiba)",
	"Special Training Booth": "Entraînement",
	Spirit: "Esprits",
	VS: "VS",
};
