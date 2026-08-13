import SidebarIconButton from "@/components/sidebar/atoms/SidebarIconButton";
import { RESEAUX } from "@/lib/social-config";

/**
 * Les réseaux sociaux dans la barre latérale.
 *
 * ── CE QUI A ÉTÉ RETIRÉ ────────────────────────────────────────────────────
 * Un `switch (name)` de six SVG écrits en dur, doublons de ceux du pied de page
 * et de `@rosegriffon/ui`. Trois copies du même dessin, c'est trois occasions de
 * diverger — et elles avaient déjà divergé sur le `viewBox` et sur la couleur de
 * survol. L'icône vient désormais de la liste elle-même
 * (`lib/social-config.ts`), qui la porte à côté de l'URL et du libellé.
 *
 * Le composant n'a plus besoin d'être un îlot client : il ne fait plus que
 * rendre des liens. `"use client"` a donc sauté, et avec lui le JavaScript
 * envoyé au navigateur pour cette section.
 */
export default function SocialLinks() {
	return (
		<nav
			aria-label="Réseaux sociaux Rose Griffon"
			className="flex items-center justify-center gap-1"
		>
			{RESEAUX.map((reseau) => {
				const Icone = reseau.icone;
				return (
					<SidebarIconButton
						key={reseau.nom}
						href={reseau.url}
						icon={<Icone className="size-4" aria-hidden />}
						label={reseau.nom}
						ariaLabel={reseau.libelle}
						color="gray"
					/>
				);
			})}
		</nav>
	);
}
