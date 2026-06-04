import { SearchX, SlidersHorizontal, User, Users, Wand2 } from "lucide-react";
import type { Metadata } from "next";
import type React from "react";
import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { PassiveFilters } from "@/components/wiki/filters/PassiveFilters";
import {
	CoordinatorPassiveCard,
	CustomPassiveCard,
	PLAYSTYLE_FR,
	PlayerPassiveCard,
	REQUIREMENT_FR,
	STAT_FR,
} from "@/components/wiki/PassiveCard";
import type {
	CoordinatorPassiveData,
	CustomPassiveData,
	PlayerPassiveData,
} from "@/components/wiki/PassiveCard";
import { WikiSearchToolbar } from "@/components/wiki/WikiSearchToolbar";
import type { SpriteCommonKey } from "@/config/sprites-common";
import passiveData from "@/data/passive-sheets.json";
import { normalizeText } from "@/lib/search-utils";
import { parseSearchParams } from "@/lib/validations";

export const metadata: Metadata = {
	description:
		"Guide complet des passifs : joueur, personnalisé, coordinateur et manager. Valeurs par rareté et style de jeu.",
	title: "Talents & Passifs | Codex Stratégique - Azalée",
};

// ── Helpers ──

function passiveSearchText(p: { requirement: string; stat: string; playstyle?: string }): string {
	const req = REQUIREMENT_FR[p.requirement] || p.requirement;
	const stat = STAT_FR[p.stat] || p.stat;
	const ps = p.playstyle ? PLAYSTYLE_FR[p.playstyle] || p.playstyle : "";
	return normalizeText(`${req} ${stat} ${ps}`);
}

/** Map stat EN key to a filter category */
function statCategory(stat: string): string {
	const s = stat.toLowerCase();
	if (s.includes("shot")) {
		return "shot";
	}
	if (s.includes("focus")) {
		return "focus";
	}
	if (s.includes("scramble")) {
		return "scramble";
	}
	if (s.includes("castle")) {
		return "castle";
	}
	if (
		s.startsWith("team") ||
		s.startsWith("[mf]") ||
		s.startsWith("[df]") ||
		s.startsWith("[kp]") ||
		s.startsWith("[substitute")
	) {
		return "team";
	}
	if (s.startsWith("own")) {
		return "own";
	}
	return "";
}

function matchesFilters(
	p: { requirement: string; stat: string; playstyle?: string },
	qNorm: string,
	playstyleFilter: string | null,
	statCatFilter: string
): boolean {
	// Text search
	if (qNorm && !passiveSearchText(p).includes(qNorm)) {
		return false;
	}
	// Playstyle filter
	if (playstyleFilter !== null && (p.playstyle ?? "") !== playstyleFilter) {
		return false;
	}
	// Stat category
	if (statCatFilter && statCategory(p.stat) !== statCatFilter) {
		return false;
	}
	return true;
}

// ── Section config ──

const PLAYSTYLE_SECTIONS: Array<{
	key: string;
	label: string;
	icon?: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
	sprite?: SpriteCommonKey;
	color: string;
}> = [
	{ color: "text-on-surface-variant", icon: SlidersHorizontal, key: "", label: "Généraux" },
	{ color: "text-red-500", key: "Breach", label: "Brèche", sprite: "breche" },
	{ color: "text-amber-500", key: "Tension", label: "Tension", sprite: "tension" },
	{ color: "text-blue-500", key: "Counter", label: "Contre-attaque", sprite: "contre" },
	{ color: "text-pink-500", key: "Bond", label: "Lien", sprite: "lien" },
	{ color: "text-orange-500", key: "Rough Play", label: "Jeu brutal", sprite: "jeu_violent" },
	{ color: "text-emerald-500", key: "Justice", label: "Justice", sprite: "justice" },
];

export default async function PassivesPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const params = parseSearchParams(await searchParams);
	const { q, type: typeFilter, playstyle: playstyleFilter, category: statCatFilter } = params;
	const qNorm = q ? normalizeText(q) : "";

	const psFilter = playstyleFilter !== undefined ? (playstyleFilter?.toString() ?? "") : null;
	const catFilter = statCatFilter?.toString() || "";

	// ── Load all data ──
	const allPlayerPassives = passiveData.playerPassives as PlayerPassiveData[];
	const allCustomPassives = passiveData.customPassives as CustomPassiveData[];
	const allCoordinatorPassives = passiveData.coordinatorPassives as CoordinatorPassiveData[];

	// ── Compute type counts (before type filter, after text/playstyle/cat filter) ──
	const playerFiltered = allPlayerPassives.filter((p) =>
		matchesFilters(p, qNorm, psFilter, catFilter)
	);
	const customFiltered = allCustomPassives.filter((p) => matchesFilters(p, qNorm, null, catFilter));
	const coordFiltered = allCoordinatorPassives.filter((p) =>
		matchesFilters(p, qNorm, psFilter, catFilter)
	);

	const typeCounts: Record<string, number> = {
		coordinator: coordFiltered.length,
		custom: customFiltered.length,
		player: playerFiltered.length,
	};

	// ── Apply type filter ──
	const showPlayer = !typeFilter || typeFilter === "player";
	const showCustom = !typeFilter || typeFilter === "custom";
	const showCoord = !typeFilter || typeFilter === "coordinator";

	const playerPassives = showPlayer ? playerFiltered : [];
	const customPassives = showCustom ? customFiltered : [];
	const coordinatorPassives = showCoord ? coordFiltered : [];

	// ── Compute playstyle counts (on visible data, before playstyle filter) ──
	const allForPlaystyleCounts = [
		...(showPlayer
			? allPlayerPassives.filter(
					(p) =>
						(!qNorm || passiveSearchText(p).includes(qNorm)) &&
						(!catFilter || statCategory(p.stat) === catFilter)
				)
			: []),
		...(showCoord
			? (
					allCoordinatorPassives as Array<{ playstyle?: string; requirement: string; stat: string }>
				).filter(
					(p) =>
						(!qNorm || passiveSearchText(p).includes(qNorm)) &&
						(!catFilter || statCategory(p.stat) === catFilter)
				)
			: []),
	];
	const playstyleCounts: Record<string, number> = {};
	for (const p of allForPlaystyleCounts) {
		const ps = p.playstyle ?? "";
		playstyleCounts[ps] = (playstyleCounts[ps] || 0) + 1;
	}

	// ── Group player passives by playstyle ──
	const playerGroups = PLAYSTYLE_SECTIONS.map((section) => ({
		...section,
		passives: playerPassives.filter((p) => p.playstyle === section.key),
	})).filter((g) => g.passives.length > 0);

	// ── Group coordinator passives by playstyle ──
	const coordGroups = PLAYSTYLE_SECTIONS.map((section) => ({
		...section,
		passives: coordinatorPassives.filter((p) => p.playstyle === section.key),
	})).filter((g) => g.passives.length > 0);

	const totalCount = playerPassives.length + customPassives.length + coordinatorPassives.length;

	return (
		<div className="space-y-8 pb-20" role="main" aria-label="Passifs et talents">
			<div className="space-y-1">
				<h1 className="text-3xl font-extrabold tracking-tight text-on-surface font-display">
					Talents & Passifs
				</h1>
				<p className="text-sm text-on-surface-variant">
					Guide complet des talents et passifs d'Inazuma Eleven: Victory Road.
				</p>
			</div>
			{/* Sticky Header */}
			<div className="sticky top-[64px] z-40 bg-surface/90 backdrop-blur-md -mx-4 px-4 py-4 border-b border-outline-variant/10">
				<div className="space-y-3">
					<div className="w-full md:max-w-md">
						<WikiSearchToolbar
							placeholder="Rechercher un passif (stat, condition...)"
							showFilters={false}
							className="bg-surface-container-high border-outline-variant/50"
						/>
					</div>

					<PassiveFilters typeCounts={typeCounts} playstyleCounts={playstyleCounts} />

					{/* Results count */}
					<div
						className="text-xs font-medium text-on-surface-variant px-1 uppercase tracking-wider"
						aria-live="polite"
					>
						{totalCount} passif{totalCount !== 1 ? "s" : ""} trouv&eacute;
						{totalCount !== 1 ? "s" : ""}
					</div>
				</div>
			</div>

			{totalCount === 0 ? (
				<div className="py-32 text-center" role="status">
					<SearchX size={60} className="mb-4 text-on-surface-variant/30" aria-hidden="true" />
					<h3 className="text-xl font-bold text-on-surface mb-2">Aucun passif trouvé</h3>
					<p className="text-on-surface-variant">
						Essayez une autre recherche ou modifiez les filtres.
					</p>
				</div>
			) : (
				<div className="space-y-16">
					{/* Player Passives */}
					{playerPassives.length > 0 && (
						<section id="player" className="scroll-mt-36" aria-labelledby="player-heading">
							<div className="flex items-center gap-4 mb-8 border-b border-outline-variant/30 pb-2">
								<User size={36} className="text-blue-600" aria-hidden="true" />
								<div>
									<h2 id="player-heading" className="text-2xl font-bold text-on-surface">
										Passifs joueur
									</h2>
									<p className="text-sm text-on-surface-variant font-medium">
										{playerPassives.length} passifs &mdash; valeurs par rareté (Légendaire &rarr;
										Commun)
									</p>
								</div>
							</div>

							<div className="space-y-10">
								{playerGroups.map((group) => (
									<div
										key={group.key || "general"}
										role="region"
										aria-label={`Style de jeu : ${group.label}`}
									>
										<div className="flex items-center gap-2 mb-4">
											{group.sprite ? (
												<div className="size-6 flex items-center justify-center">
													<CommonSpriteIcon name={group.sprite} scale={0.5} />
												</div>
											) : (
												group.icon && <group.icon size={20} className={group.color} aria-hidden />
											)}
											<h3 className="text-lg font-bold text-on-surface">{group.label}</h3>
											<span
												className="text-xs text-on-surface-variant"
												aria-label={`${group.passives.length} passifs`}
											>
												({group.passives.length})
											</span>
										</div>

										<FadeInStagger
											className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
											role="list"
											aria-label={`Passifs ${group.label}`}
										>
											{group.passives.map((p) => (
												<FadeInItem key={p.no} className="h-full" role="listitem">
													<PlayerPassiveCard passive={p} />
												</FadeInItem>
											))}
										</FadeInStagger>
									</div>
								))}
							</div>
						</section>
					)}

					{/* Custom Passives */}
					{customPassives.length > 0 && (
						<section id="custom" className="scroll-mt-36" aria-labelledby="custom-heading">
							<div className="flex items-center gap-4 mb-8 border-b border-outline-variant/30 pb-2">
								<Wand2 size={36} className="text-purple-600" aria-hidden="true" />
								<div>
									<h2 id="custom-heading" className="text-2xl font-bold text-on-surface">
										Passifs personnalisés
									</h2>
									<p className="text-sm text-on-surface-variant font-medium">
										{customPassives.length} passifs &mdash; valeur fixe unique
									</p>
								</div>
							</div>

							<FadeInStagger
								className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
								role="list"
								aria-label="Passifs personnalisés"
							>
								{customPassives.map((p) => (
									<FadeInItem key={p.no} className="h-full" role="listitem">
										<CustomPassiveCard passive={p} />
									</FadeInItem>
								))}
							</FadeInStagger>
						</section>
					)}

					{/* Coordinator / Manager Passives */}
					{coordinatorPassives.length > 0 && (
						<section
							id="coordinator"
							className="scroll-mt-36"
							aria-labelledby="coordinator-heading"
						>
							<div className="flex items-center gap-4 mb-8 border-b border-outline-variant/30 pb-2">
								<Users size={36} className="text-amber-600" aria-hidden="true" />
								<div>
									<h2 id="coordinator-heading" className="text-2xl font-bold text-on-surface">
										Passifs coordinateur / manager
									</h2>
									<p className="text-sm text-on-surface-variant font-medium">
										{coordinatorPassives.length} passifs &mdash; valeurs par rôle et rareté
									</p>
								</div>
							</div>

							<div className="space-y-10">
								{coordGroups.map((group) => (
									<div
										key={group.key || "general-coord"}
										role="region"
										aria-label={`Style de jeu : ${group.label}`}
									>
										<div className="flex items-center gap-2 mb-4">
											{group.sprite ? (
												<div className="size-6 flex items-center justify-center">
													<CommonSpriteIcon name={group.sprite} scale={0.5} />
												</div>
											) : (
												group.icon && <group.icon size={20} className={group.color} aria-hidden />
											)}
											<h3 className="text-lg font-bold text-on-surface">{group.label}</h3>
											<span
												className="text-xs text-on-surface-variant"
												aria-label={`${group.passives.length} passifs`}
											>
												({group.passives.length})
											</span>
										</div>

										<FadeInStagger
											className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
											role="list"
											aria-label={`Passifs coordinateur ${group.label}`}
										>
											{group.passives.map((p) => (
												<FadeInItem key={p.no} className="h-full" role="listitem">
													<CoordinatorPassiveCard passive={p} />
												</FadeInItem>
											))}
										</FadeInStagger>
									</div>
								))}
							</div>
						</section>
					)}
				</div>
			)}
		</div>
	);
}
