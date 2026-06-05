export const dynamic = "force-dynamic";

import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { QuestCard } from "@/components/wiki/QuestCard";
import { QuestFilterBar } from "@/components/wiki/QuestFilterBar";
import { getQuestsList, type QuestKind } from "@/lib/wiki/quests";

export const metadata: Metadata = {
	alternates: { canonical: "/quete" },
	description:
		"Liste complète des quêtes d'Inazuma Eleven: Victory Road — objectifs d'histoire principale et quêtes annexes, avec titres localisés (FR / EN / JP).",
	title: "Quêtes | Inazuma Eleven Victory Road - Azalée",
};

export default async function QuetesPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const raw = await searchParams;
	const q = typeof raw.q === "string" ? raw.q : "";
	const kindParam = typeof raw.kind === "string" ? raw.kind : "all";
	const kind: QuestKind | "all" =
		kindParam === "main" || kindParam === "side" ? kindParam : "all";

	const { quests, total, main, side } = await getQuestsList({ q, kind });

	return (
		<div className="w-full space-y-6">
			{/* En-tête */}
			<div>
				<h1 className="text-2xl font-black tracking-tight text-on-surface lg:text-3xl">
					Quêtes
				</h1>
				<p className="mt-1 text-sm text-on-surface-variant">
					{total} quêtes — {main} d&apos;histoire principale et {side} annexes.
				</p>
			</div>

			{/* Filtre + recherche */}
			<QuestFilterBar counts={{ all: total, main, side }} />

			{/* Grille */}
			{quests.length > 0 ? (
				<FadeInStagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{quests.map((quest) => (
						<FadeInItem key={quest.id}>
							<QuestCard quest={quest} />
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
					<p className="text-on-surface-variant">Aucune quête trouvée.</p>
				</div>
			)}
		</div>
	);
}
