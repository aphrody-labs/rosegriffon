export const dynamic = "force-dynamic";

import type { Metadata } from "next";

import { ProjectCard } from "@/components/shared/ProjectCard";
import { BreadcrumbSchema } from "@/components/shared/StructuredData";

import { Sparkles } from "@/lib/icons-config";
import { PROJETS } from "@/lib/projets";

export const metadata: Metadata = {
	alternates: { canonical: "https://rosegriffon.fr/projets" },
	description: "Découvrez les outils et initiatives créatives de la communauté Rose Griffon.",
	title: "Projets | Rose Griffon",
};

export default function ProjetsPage() {
	return (
		<div className="space-y-12 pb-12">
			<BreadcrumbSchema
				items={[
					{ item: "/", name: "Accueil" },
					{ item: "/projets", name: "Projets" },
				]}
			/>

			{/* En-tête */}
			<section className="relative overflow-hidden rounded-3xl border border-outline-variant bg-linear-to-br from-primary-container to-surface-variant p-8 text-center shadow-sm md:p-12 lg:p-16">
				<div className="absolute right-0 top-0 -mr-12 -mt-12 size-64 rounded-full bg-primary opacity-10 blur-3xl" />
				<div className="absolute bottom-0 left-0 -mb-12 -ml-12 size-64 rounded-full bg-tertiary opacity-10 blur-3xl" />

				<div className="relative z-10 mx-auto max-w-3xl space-y-6">
					<div className="inline-flex items-center rounded-full border border-outline bg-surface/50 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm">
						<Sparkles className="mr-2 size-4" />
						<span>Espace créatif</span>
					</div>

					<h1 className="text-4xl font-extrabold tracking-tight text-on-surface sm:text-5xl md:text-6xl">
						Nos projets
					</h1>

					<p className="text-lg leading-relaxed text-on-surface-variant md:text-xl">
						Découvrez les outils et les espaces collaboratifs développés pour et par la communauté
						Rose Griffon.
					</p>
				</div>
			</section>

			{/* Grille — même carte et mêmes données que l'extrait de la page d'accueil */}
			<section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
				{PROJETS.map((projet) => (
					<ProjectCard key={projet.slug} projet={projet} />
				))}
			</section>
		</div>
	);
}
