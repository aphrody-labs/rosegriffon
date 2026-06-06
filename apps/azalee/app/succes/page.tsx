export const dynamic = "force-dynamic";

import { Award, SearchX, Trophy as TrophyIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { WikiSearchToolbar } from "@/components/wiki/WikiSearchToolbar";
import { parseSearchParams } from "@/lib/validations";
import { getTrophiesList } from "@/lib/wiki/trophies";
import {
	CATEGORY_LABELS,
	type Trophy,
	type TrophyCategory,
} from "@/lib/wiki/trophies-shared";

export const metadata: Metadata = {
	alternates: { canonical: "/succes" },
	description:
		"Liste complète des succès et trophées d'Inazuma Eleven: Victory Road — trophées officiels et objectifs d'activité in-game, avec noms et descriptions localisés (FR / EN / JP).",
	title: "Succès | Inazuma Eleven Victory Road - Azalée",
};

/** Onglet de filtre catégorie (Link server-side, préserve la recherche `q`). */
function CategoryTab({
	active,
	href,
	label,
	count,
}: {
	active: boolean;
	href: string;
	label: string;
	count: number;
}) {
	return (
		<Link
			href={href}
			className={
				active
					? "rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-on-primary"
					: "rounded-full border border-outline-variant/40 bg-surface-container-low px-3.5 py-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container"
			}
		>
			{label} <span className="opacity-70">{count}</span>
		</Link>
	);
}

/** Carte d'un succès dans la grille. */
function TrophyCard({ trophy }: { trophy: Trophy }) {
	const isOfficial = trophy.category === "trophy";
	const Icon = isOfficial ? TrophyIcon : Award;
	return (
		<Link
			href={`/succes/${trophy.id}`}
			className="group flex h-full gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 transition-colors hover:bg-surface-container"
		>
			<div
				className={
					isOfficial
						? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
						: "flex size-11 shrink-0 items-center justify-center rounded-xl bg-tertiary/10 text-tertiary"
				}
			>
				<Icon size={22} aria-hidden="true" />
			</div>
			<div className="min-w-0">
				<span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/60">
					{trophy.groupLabel}
				</span>
				<h2 className="truncate text-sm font-semibold text-on-surface group-hover:text-primary">
					{trophy.name}
				</h2>
				{trophy.desc && (
					<p className="mt-0.5 line-clamp-2 text-xs text-on-surface-variant">{trophy.desc}</p>
				)}
			</div>
		</Link>
	);
}

export default async function SuccesPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const rawParams = await searchParams;
	const params = parseSearchParams(rawParams);
	const q = params.q || "";
	const catParam = typeof rawParams.cat === "string" ? rawParams.cat : "all";
	const cat: TrophyCategory | "all" =
		catParam === "trophy" || catParam === "activity" ? catParam : "all";

	const { trophies, counts } = await getTrophiesList({ q, cat });

	/** Construit un href d'onglet en conservant la recherche courante. */
	const tabHref = (next: "all" | TrophyCategory) => {
		const sp = new URLSearchParams();
		if (next !== "all") sp.set("cat", next);
		if (q) sp.set("q", q);
		const qs = sp.toString();
		return qs ? `/succes?${qs}` : "/succes";
	};

	return (
		<div className="w-full space-y-6">
			{/* En-tête */}
			<div>
				<h1 className="text-2xl font-black tracking-tight text-on-surface lg:text-3xl">Succès</h1>
				<p className="mt-1 text-sm text-on-surface-variant">
					{counts.all} succès — {counts.trophy} trophées officiels et {counts.activity} objectifs
					d&apos;activité.
				</p>
			</div>

			{/* Recherche */}
			<WikiSearchToolbar placeholder="Rechercher un succès..." showFilters={false} />

			{/* Filtre catégorie */}
			<div className="flex flex-wrap gap-2">
				<CategoryTab active={cat === "all"} href={tabHref("all")} label="Tous" count={counts.all} />
				<CategoryTab
					active={cat === "trophy"}
					href={tabHref("trophy")}
					label={CATEGORY_LABELS.trophy}
					count={counts.trophy}
				/>
				<CategoryTab
					active={cat === "activity"}
					href={tabHref("activity")}
					label={CATEGORY_LABELS.activity}
					count={counts.activity}
				/>
			</div>

			{/* Grille */}
			{trophies.length > 0 ? (
				<FadeInStagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{trophies.map((trophy) => (
						<FadeInItem key={trophy.id}>
							<TrophyCard trophy={trophy} />
						</FadeInItem>
					))}
				</FadeInStagger>
			) : (
				<div className="py-16 text-center">
					<SearchX
						size={48}
						className="mb-4 block text-on-surface-variant/30"
						aria-hidden="true"
					/>
					<p className="text-on-surface-variant">Aucun succès trouvé.</p>
				</div>
			)}
		</div>
	);
}
