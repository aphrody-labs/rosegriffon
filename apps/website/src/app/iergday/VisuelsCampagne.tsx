"use client";

import { AspectRatio } from "@rosegriffon/ui";
import { Maximize2, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import { type DocumentVisionne, Visionneuse } from "./Visionneuse";

/*
 * Les visuels officiels de la campagne (affiche, carte des règles), consultables
 * en grand.
 *
 * Ce sont des DOCUMENTS, pas des décors : ils portent du texte, et ce texte est
 * la parole de l'association. Ils sont donc affichés ENTIERS (`object-contain`,
 * jamais `object-cover`), et la légende de la visionneuse donne en clair ce que
 * la base sait de ce document — un lecteur d'écran, un moteur de recherche ou un
 * visiteur en connexion dégradée ne lisent pas les pixels.
 *
 * ⚠ PUBLIER UN DOCUMENT, C'EST PUBLIER CE QU'IL ÉCRIT. Un contrôle « la coquille
 * n'apparaît pas dans le HTML » est vrai et sans valeur : le visiteur lit des
 * pixels. Quand un visuel se contredit avec la règle officielle (l'affiche IERG
 * Day annonce un hashtag différent de celui de la carte « Règles »), la seule
 * façon de ne pas propager l'erreur en republiant l'image est de la rectifier
 * juste à côté — `note_affiche`, lue en base, jamais écrite ici : c'est un fait
 * sur CETTE affiche, pas une règle de la page.
 *
 * La visionneuse n'est PAS réécrite ici : c'est `Visionneuse.tsx`, la même que
 * celle de la galerie, qui montre des `DocumentVisionne`. Ces visuels-là
 * n'existent pas comme publications X — les faire passer pour des `PostCampagne`
 * aurait exigé d'inventer un identifiant de tweet et un auteur.
 */

/*
 * ⚠ Le `sizes` décrit la mise en page RÉELLE, mesurée, pas la grille des tuiles
 * prise isolément : ces vignettes vivent dans la colonne étroite (`2fr` sur `5`)
 * de « Comment participer ». Mesures au navigateur : 341 px à 375, 308 px à 768,
 * 280 px à 1024 (une seule colonne à partir de `lg`, cf. plus bas), 186 px à
 * 1280, 226 px à 1920. Le `33vw` d'origine annonçait 633 px pour une tuile de
 * 226 px — trois fois trop d'octets sur chaque affiche.
 */
const TAILLES_VIGNETTE =
	"(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 30vw, 16vw";

/**
 * En présentation `grand`, les deux documents occupent une pleine largeur sur
 * mobile et une demi-largeur d'un conteneur plafonné à 64 rem au-delà.
 */
const TAILLES_GRAND = "(max-width: 767px) 100vw, 32rem";

/**
 * Deux présentations, un seul composant.
 *
 * `colonne` — les deux visuels en petit, dans la colonne étroite de « Comment
 * participer » : ils y sont un rappel, pas le sujet.
 *
 * `grand` — l'affiche à la taille où elle se lit VRAIMENT. Une affiche est un
 * document composé pour être vu en entier : réduite à 226 px de côté dans une
 * colonne, son titre reste lisible mais ni la date de fin, ni le hashtag, ni la
 * consigne ne le sont — c'est-à-dire exactement ce qu'elle est là pour dire.
 */
export type PresentationVisuels = "colonne" | "grand";

/** Une vignette cliquable. Le pictogramme signale qu'on peut agrandir. */
function Vignette({
	document,
	onOuvrir,
	grand = false,
}: {
	document: DocumentVisionne;
	onOuvrir: () => void;
	grand?: boolean;
}) {
	const image = document.images[0];
	if (!image) {
		return null;
	}
	return (
		<button
			type="button"
			onClick={onOuvrir}
			aria-label={`Agrandir : ${document.etiquette}`}
			className="group block w-full cursor-zoom-in overflow-hidden rounded-[24px] border-2 border-rg-or/40 bg-surface-container-low text-left shadow-[0_4px_0_0_rgba(0,0,0,0.5)] transition-transform duration-300 motion-safe:hover:-translate-y-1 focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-primary"
		>
			{/*
			 * `ratio={3 / 4}` en grand : les deux visuels sont des portraits (l'affiche
			 * fait 1063 × 1483, la carte des règles 8334 × 11443). Un carré leur
			 * ajoutait deux bandes vides d'un quart de hauteur chacune. `object-contain`
			 * dans les deux cas : un document ne se recadre pas, il se lit entier.
			 */}
			<AspectRatio ratio={grand ? 3 / 4 : 1}>
				<Image
					src={image.src}
					alt={image.alt}
					fill
					sizes={grand ? TAILLES_GRAND : TAILLES_VIGNETTE}
					priority={grand}
					className="object-contain"
				/>
			</AspectRatio>
			{/*
			 * Les libellés PASSENT À LA LIGNE, ils ne sont pas coupés : entre 1024 et
			 * 1280 px la tuile ne fait qu'une centaine de pixels de large, et
			 * `truncate` y amputait « Les règles, en image » de 43 % — « Les règle… »
			 * juste sous une affiche déjà illisible à cette taille.
			 */}
			<span className="flex items-center justify-between gap-2 border-t border-outline-variant/40 px-4 py-3">
				<span className="min-w-0">
					<span className="block text-sm font-bold leading-tight break-words text-on-surface">
						{document.titre}
					</span>
					{document.sousTitre && (
						<span className="mt-0.5 block text-xs leading-tight break-words text-on-surface-variant">
							{document.sousTitre}
						</span>
					)}
				</span>
				<Maximize2 className="size-4 shrink-0 text-primary" aria-hidden />
			</span>
		</button>
	);
}

export function VisuelsCampagne({
	slug,
	titreCampagne,
	description,
	reglement,
	imageAffiche,
	imageReglement,
	noteAffiche,
	presentation = "colonne",
}: {
	slug: string;
	titreCampagne: string;
	description: string | null;
	/** Règles en clair — servent de légende accessible à la carte des règles. */
	reglement: string[];
	imageAffiche: string | null;
	imageReglement: string | null;
	/** Rectification à afficher sous l'affiche (`x_campagnes.note_affiche`). */
	noteAffiche: string | null;
	/** Taille d'affichage. Voir `PresentationVisuels`. */
	presentation?: PresentationVisuels;
}) {
	const [indexOuvert, setIndexOuvert] = useState<number | null>(null);

	const documents = useMemo<DocumentVisionne[]>(() => {
		const liste: DocumentVisionne[] = [];
		if (imageAffiche) {
			const etiquette = `Affiche officielle de la campagne « ${titreCampagne} »`;
			liste.push({
				baseNomFichier: `${slug}-affiche`,
				cle: "affiche",
				etiquette,
				images: [{ alt: etiquette, source: imageAffiche, src: imageAffiche }],
				// La rectification suit l'affiche jusque dans la visionneuse : c'est
				// là que l'image est la plus lisible, donc là que la consigne fautive
				// se lit le mieux.
				legende: [description, noteAffiche].filter(Boolean).join("\n\n") || null,
				sousTitre: titreCampagne,
				titre: "Affiche officielle",
			});
		}
		if (imageReglement) {
			const etiquette = `Règles de la campagne « ${titreCampagne} »`;
			liste.push({
				baseNomFichier: `${slug}-reglement`,
				cle: "reglement",
				etiquette,
				images: [{ alt: etiquette, source: imageReglement, src: imageReglement }],
				// Le texte de l'image, en clair : c'est la même liste que la section
				// « Comment participer », lue depuis la base.
				legende: reglement.length > 0 ? reglement.map((regle) => `• ${regle}`).join("\n") : null,
				sousTitre: titreCampagne,
				titre: "Les règles, en image",
			});
		}
		return liste;
	}, [slug, titreCampagne, description, noteAffiche, reglement, imageAffiche, imageReglement]);

	if (documents.length === 0) {
		return null;
	}

	return (
		<>
			{/*
			 * ⚠ PAS DE `flex` SUR LE `li`, et une seule colonne entre `lg` et `xl`.
			 * Ces tuiles vivent dans la colonne étroite de « Comment participer »,
			 * dont la hauteur est celle du règlement d'à côté. Un `li` en `flex`
			 * étirait le `<button>` sur toute cette hauteur, et un bouton centre son
			 * contenu : à 1024 px la carte faisait 553 px de haut pour une image de
			 * 130 px — 65 % de vide bordé d'or, mesuré au navigateur. Sans `flex`, la
			 * carte reprend la hauteur de son contenu ; `lg:grid-cols-1` lui rend au
			 * passage une largeur lisible (280 px au lieu de 134) là où deux colonnes
			 * ne tenaient pas.
			 */}
			<ul
				className={
					presentation === "grand"
						? "mx-auto grid list-none grid-cols-1 gap-6 p-0 md:max-w-5xl md:grid-cols-2"
						: "grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
				}
			>
				{documents.map((document, position) => (
					<li key={document.cle}>
						<Vignette
							document={document}
							grand={presentation === "grand"}
							onOuvrir={() => setIndexOuvert(position)}
						/>
						{document.cle === "affiche" && noteAffiche && (
							<p className="mt-2 flex items-start gap-2 rounded-2xl border border-error/50 bg-error-container px-3 py-2 text-xs leading-relaxed text-on-error-container">
								<TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
								<span>{noteAffiche}</span>
							</p>
						)}
					</li>
				))}
			</ul>

			<Visionneuse
				documents={documents}
				index={indexOuvert}
				onFermer={() => setIndexOuvert(null)}
				onNaviguer={setIndexOuvert}
			/>
		</>
	);
}
