import { Button } from "@rosegriffon/ui";
import Link from "next/link";

import { ProjectCard } from "@/components/shared/ProjectCard";

import { ArrowRight } from "@/lib/icons-config";
import { PROJETS, PROJETS_ACCUEIL } from "@/lib/projets";

/**
 * Extrait « Nos projets » de la page d'accueil.
 *
 * Ce n'est PAS une seconde implémentation de la page `/projets` : même source
 * de données (`@/lib/projets`) et même carte (`ProjectCard`). Seul le nombre
 * d'entrées change, d'où le lien « Voir tous les projets » en pied de section.
 */
export default function ProjectsSection() {
	return (
		<div className="mx-auto w-full max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
			<div className="space-y-3 text-center">
				<h2
					id="projects-heading"
					className="text-3xl font-black tracking-tight text-foreground sm:text-4xl md:text-5xl"
				>
					Nos projets
				</h2>
				<p className="mx-auto max-w-2xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
					Découvrez l&apos;écosystème Rose Griffon : médias, outils et contenus communautaires.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
				{PROJETS_ACCUEIL.map((projet) => (
					<ProjectCard key={projet.slug} projet={projet} />
				))}
			</div>

			{PROJETS.length > PROJETS_ACCUEIL.length && (
				<div className="flex justify-center">
					<Button asChild variant="outline" size="lg">
						<Link href="/projets">
							Voir tous les projets
							<ArrowRight className="ml-2 size-4" />
						</Link>
					</Button>
				</div>
			)}
		</div>
	);
}
