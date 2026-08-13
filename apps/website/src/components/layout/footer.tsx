import Link from "next/link";

import { ReseauxSociaux } from "@/components/shared/ReseauxSociaux";

/**
 * Pied de page du site.
 *
 * ── CE QUI A ÉTÉ RETIRÉ, ET POURQUOI ───────────────────────────────────────
 *  * SIX SVG ÉCRITS EN DUR (X, Twitch, YouTube, Instagram…), doublons de ceux de
 *    la barre latérale et de `@rosegriffon/ui`. Ils avaient déjà divergé : le
 *    survol de TikTok portait le dégradé d'Instagram, recopié du bloc voisin.
 *    Tout passe par `ReseauxSociaux`, alimenté par `lib/social-config.ts`.
 *  * NEUF COULEURS EN DUR (`bg-black`, `#9146FF`, `#FF0000`, le dégradé
 *    Instagram, `text-white`). Une couleur littérale ne suit pas le sélecteur de
 *    thème : c'est ce qui rendait des surfaces illisibles en thème sombre.
 *  * LA MÊME CHAÎNE DE NEUF CLASSES recopiée sur chaque lien. Elle vit dans
 *    `lienPied`, écrite une fois.
 *  * L'ANNÉE 2025 ÉCRITE EN DUR, fausse depuis le 1er janvier. Elle est calculée.
 */

/** Un lien de colonne. Une seule définition pour les huit. */
const lienPied =
	"text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm";

/** Les colonnes du pied, en données : ajouter un lien ne demande pas de JSX. */
const COLONNES = [
	{
		titre: "L'association",
		liens: [
			{ href: "/charte-engagements", texte: "Charte et engagements" },
			{
				externe: true,
				href: "https://www.journal-officiel.gouv.fr/pages/associations-detail-annonce/?q.id=id:202400200922",
				texte: "Numéro RNA",
			},
			{ href: "https://azalee.rosegriffon.fr", texte: "Wiki Azalée" },
			{ href: "https://achillea.rosegriffon.fr", texte: "Achilléa — compétitif" },
		],
	},
	{
		titre: "Contact",
		liens: [
			{ href: "/a-propos/contact", texte: "Nous contacter" },
			{ href: "/a-propos/soutenir", texte: "Nous soutenir" },
		],
	},
	{
		titre: "Légal",
		liens: [
			{ href: "/legal/cgu", texte: "Conditions d'utilisation" },
			{ href: "/legal/confidentialite", texte: "Confidentialité" },
		],
	},
] as const;

export default function Footer() {
	// Calculée au rendu : le pied de page est servi par des routes dynamiques et
	// des routes statiques régénérées — dans les deux cas l'année est juste, là
	// où un littéral devient faux le 1er janvier et le reste douze mois.
	const annee = new Date().getFullYear();

	return (
		<footer className="footer-safe w-full border-t border-border/40 bg-background">
			{/* Mobile d'abord : une colonne, puis deux, puis quatre. Le texte reste
			    aligné à gauche même sur mobile — centrer une liste de liens rend le
			    balayage vertical plus difficile, chaque ligne repartant d'un x
			    différent. */}
			<div className="container mx-auto grid grid-cols-1 gap-6 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
				{COLONNES.map((colonne) => (
					<nav key={colonne.titre} aria-label={colonne.titre} className="flex flex-col gap-1.5">
						<h2 className="text-sm font-semibold text-foreground">{colonne.titre}</h2>
						{colonne.liens.map((lien) => (
							<Link
								key={lien.href}
								href={lien.href}
								className={lienPied}
								{...("externe" in lien && lien.externe
									? { rel: "noopener noreferrer", target: "_blank" }
									: {})}
							>
								{lien.texte}
							</Link>
						))}
					</nav>
				))}

				<div className="flex flex-col gap-2">
					<h2 className="text-sm font-semibold text-foreground">Suivez-nous</h2>
					<ReseauxSociaux />
				</div>
			</div>

			<div className="container mx-auto flex flex-col items-center gap-1 border-t border-border/40 px-4 py-4 text-center sm:px-6 lg:px-8">
				<p className="text-xs text-muted-foreground">
					Rose Griffon © {annee} — tous droits réservés
				</p>
				<p className="text-xs text-muted-foreground">
					Conçu et développé par{" "}
					<Link
						href="https://x.com/yoyo__goat"
						target="_blank"
						rel="author me noopener noreferrer"
						className="font-medium transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-sm"
					>
						yoyo
					</Link>
				</p>
			</div>
		</footer>
	);
}
