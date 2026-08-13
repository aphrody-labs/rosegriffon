import Link from "next/link";

import { RESEAUX } from "@/lib/social-config";
import { cn } from "@/lib/utils";

/**
 * LA RANGÉE DE RÉSEAUX SOCIAUX — un seul composant pour tout le site.
 *
 * Le pied de page et la barre latérale affichaient la même chose, écrite deux
 * fois : six `<Link>` à la main d'un côté, un `switch` de SVG inlinés de
 * l'autre. Les deux copies avaient déjà divergé — le survol TikTok du pied de
 * page portait le dégradé d'Instagram, recopié d'un bloc voisin.
 *
 * La liste, les URL, les libellés d'accessibilité et les couleurs de survol
 * vivent désormais dans `lib/social-config.ts` ; le dessin des icônes dans
 * `@rosegriffon/ui`. Ce fichier ne décide plus que de la MISE EN PAGE.
 *
 * ⚠ Cible tactile de 44 px minimum (`size-11`) : c'est la seule taille qui rend
 * ces liens cliquables au pouce. Une pastille de 36 px se manque une fois sur
 * trois, et ces six liens sont, sur mobile, le seul chemin vers la communauté.
 */
export function ReseauxSociaux({ className }: { className?: string }) {
	return (
		<ul className={cn("flex list-none flex-wrap gap-2 p-0", className)}>
			{RESEAUX.map((reseau) => {
				const Icone = reseau.icone;
				return (
					<li key={reseau.nom}>
						<Link
							href={reseau.url}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={reseau.libelle}
							className={cn(
								"flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors duration-200",
								"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
								"motion-safe:hover:scale-110 motion-safe:transition-transform",
								reseau.couleurSurvol
							)}
						>
							<Icone className="size-5" aria-hidden />
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
