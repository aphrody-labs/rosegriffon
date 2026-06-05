export const dynamic = "force-dynamic";

import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { FilterChips } from "@/components/wiki/FilterChips";
import { CoachCard } from "@/components/wiki/CoachCard";
import { WikiSearchToolbar } from "@/components/wiki/WikiSearchToolbar";
import {
	COACH_ELEMENT_OPTIONS,
	COACH_PLAYSTYLE_OPTIONS,
	COACH_ROLE_OPTIONS,
	getCoachesList,
} from "@/lib/wiki/coaches";
import { parseSearchParams } from "@/lib/validations";

export const metadata: Metadata = {
	alternates: { canonical: "/entraineur" },
	description:
		"Liste complète des entraîneurs, managers et coachs d'Inazuma Eleven: Victory Road. Bonus passifs d'équipe, conditions d'activation, élément et style de jeu.",
	title: "Entraîneurs & Coachs | Inazuma Eleven Victory Road - Azalée",
};

export default async function CoachesPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const rawParams = await searchParams;
	const params = parseSearchParams(rawParams);

	const coaches = await getCoachesList({
		element: params.element,
		playstyle: params.playstyle,
		q: params.q || "",
		role: params.role,
	});

	return (
		<div className="w-full space-y-6">
			{/* En-tête */}
			<div>
				<h1 className="text-2xl font-black tracking-tight text-on-surface lg:text-3xl">
					Entraîneurs &amp; Coachs
				</h1>
				<p className="mt-1 text-sm text-on-surface-variant">
					{coaches.length} membre{coaches.length > 1 ? "s" : ""} de banc avec leurs passifs
					d'équipe
				</p>
			</div>

			{/* Recherche + filtres */}
			<WikiSearchToolbar
				placeholder="Rechercher un entraîneur..."
				filterKeys={["role", "element", "playstyle"]}
			>
				<div className="space-y-4">
					<div>
						<p className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant/70">
							Rôle
						</p>
						<FilterChips paramName="role" options={[...COACH_ROLE_OPTIONS]} />
					</div>
					<div>
						<p className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant/70">
							Élément
						</p>
						<FilterChips paramName="element" options={[...COACH_ELEMENT_OPTIONS]} />
					</div>
					<div>
						<p className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant/70">
							Style de jeu
						</p>
						<FilterChips paramName="playstyle" options={[...COACH_PLAYSTYLE_OPTIONS]} />
					</div>
				</div>
			</WikiSearchToolbar>

			{/* Grille */}
			{coaches.length > 0 ? (
				<FadeInStagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
					{coaches.map((c) => (
						<FadeInItem key={c.id}>
							<CoachCard
								id={c.id}
								name={c.name}
								role={c.role}
								roleFr={c.roleFr}
								playstyleFr={c.playstyleFr}
								elementKey={c.elementKey}
								elementFr={c.elementFr}
								stat={c.stat}
								buff={c.buff}
							/>
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
					<p className="text-on-surface-variant">Aucun entraîneur trouvé.</p>
				</div>
			)}
		</div>
	);
}
