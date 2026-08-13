import {
	Button,
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@rosegriffon/ui";
import {
	Hash,
	ImageIcon,
	Sparkles,
	Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
	PageContainer,
	PageHero,
} from "@/components/shared/PageShell";
import { BreadcrumbSchema } from "@/components/shared/StructuredData";
import { WikiPagination } from "@/components/shared/WikiPagination";
import { dimensionsImage } from "@/lib/images/dimensions";
import { parseSearchParams } from "@/lib/validations";
import {
	chargerCampagne,
	compterPostsCampagne,
	lienDepotDiscord,
	listerCampagnesPubliees,
	listerPostsCampagne,
	listerPostsEnAvant,
} from "@/lib/x-campagnes/queries";
import {
	type Campagne,
	entierPositif,
	etatCampagne,
	extraitTexte,
	formaterDateHeureParis,
	formaterDateParis,
	hashtagsAffichables,
	urlPublicationX,
	urlRechercheX,
} from "@/lib/x-campagnes/types";

import { BoutonsParticiper } from "./BoutonsParticiper";
import { CampagneGalerie } from "./CampagneGalerie";
import { DepotInstagram } from "./DepotInstagram";
import { CompteARebours } from "./CompteARebours";
import { HashtagsCopiables } from "./HashtagsCopiables";
import { SelecteurCampagne } from "./SelecteurCampagne";
import { VisuelsCampagne } from "./VisuelsCampagne";

/*
 * Mur communautaire des campagnes à hashtag X.
 *
 * La page n'est PAS figée sur `#IERGDay` : la campagne affichée est celle qui
 * porte `principale` en base, et `?campagne=<slug>` permet de consulter les
 * autres. Lancer, arrêter ou changer la campagne à la une = un `UPDATE`, jamais
 * un déploiement. Tout ce que la page raconte — titre, règlement, hashtags,
 * bornes, visuels — vient de `x_campagnes`, rien n'est écrit en dur ici.
 *
 * ⚠ CE N'EST PAS QU'UNE GALERIE. Une campagne annoncée n'a, par construction,
 * aucune publication le jour de son annonce : c'est l'état NORMAL, pas un cas
 * limite. La page doit alors tenir debout toute seule — affiche, règles, compte
 * à rebours, hashtag copiable, appel à participer — et la galerie reprend
 * simplement sa place dès la première publication récoltée.
 *
 * `force-dynamic` + `revalidate = 0` : la galerie se remplit au fil de la
 * récolte, et `await searchParams` rend de toute façon la route dynamique
 * (même couple que `app/admin/patreon/page.tsx`).
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const POSTS_PAR_PAGE = 24;
const ORIGINE = "https://rosegriffon.fr";

/** Lit `?campagne=` sans toucher au schéma partagé `parseSearchParams`. */
function lireSlug(params: Record<string, string | string[] | undefined>): string | undefined {
	const brut = params.campagne;
	return typeof brut === "string" && brut.trim() ? brut.trim() : undefined;
}

/**
 * Chemin canonique d'une campagne. La campagne à la une vit à la racine de la
 * route ; les autres portent leur slug, y compris dans la balise `canonical` —
 * annoncer `/iergday` alors que l'écran montre « Inazuma Day 2026 » ferait
 * indexer le mauvais contenu.
 */
function cheminCampagne(campagne: Pick<Campagne, "principale" | "slug">): string {
	return campagne.principale ? "/iergday" : `/iergday?campagne=${campagne.slug}`;
}

/** Période éditoriale en français, TOUJOURS en heure de Paris (le VPS tourne en UTC). */
function formaterPeriode(campagne: Campagne): string | null {
	const debut = formaterDateParis(campagne.debutLe);
	const fin = formaterDateParis(campagne.finLe);
	if (debut && fin) {
		return `Du ${debut} au ${fin}`;
	}
	if (debut) {
		return `Depuis le ${debut}`;
	}
	if (fin) {
		return `Jusqu'au ${fin}`;
	}
	return null;
}

/** Ce que l'îlot de compte à rebours doit décompter — décidé côté SERVEUR. */
interface Rebours {
	cibleIso: string;
	echeance: string;
	libelle: string;
	libelleEcoule: string;
}

/**
 * Choisit l'instant à décompter, ou `null` quand il n'y a rien à décompter.
 *
 * Une campagne terminée n'affiche aucun compte à rebours ; une campagne à venir
 * décompte vers son OUVERTURE, pas vers sa clôture. L'îlot client ne décide de
 * rien : il bat la seconde et gère son propre passage à zéro.
 */
function choisirRebours(
	campagne: Campagne,
	etat: ReturnType<typeof etatCampagne>
): Rebours | null {
	if (etat === "en-cours" && campagne.finLe) {
		return {
			cibleIso: campagne.finLe,
			echeance: `Clôture le ${formaterDateHeureParis(campagne.finLe)}, heure de Paris.`,
			libelle: "Fin de la campagne dans",
			libelleEcoule: "La campagne vient de se clore",
		};
	}
	if (etat === "a-venir" && campagne.debutLe) {
		return {
			cibleIso: campagne.debutLe,
			echeance: `Ouverture le ${formaterDateHeureParis(campagne.debutLe)}, heure de Paris.`,
			libelle: "Ouverture dans",
			libelleEcoule: "La campagne vient d'ouvrir",
		};
	}
	return null;
}

export async function generateMetadata({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
	const campagne = await chargerCampagne(lireSlug(await searchParams));

	if (!campagne) {
		return {
			alternates: { canonical: `${ORIGINE}/iergday` },
			description:
				"Les créations de la communauté Inazuma Eleven publiées sur X pour les campagnes à hashtag de l'association Rose Griffon.",
			title: "Campagnes communautaires | Rose Griffon",
		};
	}

	// Le hashtag DANS le titre : c'est ce qu'un participant cherche, et ce qui
	// distingue deux campagnes qui s'appellent toutes les deux « Inatober RG ».
	const hashtag = hashtagsAffichables(campagne)[0]?.libelle;
	const titre = hashtag
		? `${campagne.titre} — ${hashtag} | Rose Griffon`
		: `${campagne.titre} | Rose Griffon`;
	// `extraitTexte` coupe au mot près et ajoute une ellipse, là où un `slice(0, 160)`
	// tranchait au milieu d'un mot.
	const description = campagne.description
		? extraitTexte(campagne.description, 160)
		: "Les créations de la communauté Inazuma Eleven publiées sur X pour les campagnes à hashtag de l'association Rose Griffon.";
	const url = `${ORIGINE}${cheminCampagne(campagne)}`;

	return {
		alternates: { canonical: url },
		description,
		openGraph: {
			description,
			images: [
				campagne.imageCouverture
					? // Le visuel RÉEL de la campagne. Ni `width` ni `height` : ils
						// dépendent du fichier téléversé, et les annoncer au jugé serait
						// une donnée fausse dans la balise.
						{ alt: `${campagne.titre} — Rose Griffon`, url: campagne.imageCouverture }
					: { alt: "Campagnes communautaires Rose Griffon", height: 630, url: "/opengraph-image.png", width: 1200 },
			],
			title: titre,
			type: "website",
			url,
		},
		title: titre,
		twitter: { card: "summary_large_image" },
	};
}

/**
 * Compteur — une PUCE, pas une tuile.
 *
 * ⚠ TOKENS DE SURFACE, PAS LES COULEURS DE LA BANNIÈRE. Ces puces vivaient dans
 * `PageHero`, sur son dégradé marine : `text-rg-sur-marine` (blanc cassé) y était
 * le bon choix. La bannière retirée, elles se sont retrouvées sur le fond de
 * page — blanc cassé sur blanc, donc **illisibles en thèmes Roy et Gaëlle
 * clairs**. Une couleur de marque ne suit pas le sélecteur de thème ; les tokens
 * de surface, si.
 *
 * ⚠ NI LA VALEUR NI LE LIBELLÉ NE SONT COUPÉS. La valeur affiche parfois une
 * durée (« 22 minutes ») et non un nombre : couper « 22 minu… » serait pire que
 * de la laisser passer à la ligne. À 375 px il ne reste qu'une centaine de
 * pixels par colonne, et `truncate` amputait « publications a… » de 38 %.
 *
 * Mobile d'abord : les deux compteurs tiennent sur UNE ligne dès 320 px parce
 * qu'ils sont écrits en ligne (`chiffre libellé`) au lieu d'empiler une valeur
 * en gros au-dessus d'un libellé en petit. C'est deux fois moins de hauteur pour
 * la même information.
 */
function Compteur({
	icone: Icone,
	valeur,
	libelle,
}: {
	icone: typeof Users;
	valeur: string;
	libelle: string;
}) {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/60 bg-surface-container-low px-3 py-1.5 text-xs">
			<Icone className="size-3.5 shrink-0 text-primary" aria-hidden />
			<strong className="font-bold tabular-nums text-on-surface">{valeur}</strong>
			<span className="text-on-surface-variant">{libelle}</span>
		</span>
	);
}

/**
 * Titre de section — volontairement plus petit que `SectionHeading`.
 *
 * `SectionHeading` pose un `text-fluid-headline-lg` avec pastille d'icône et
 * sous-titre : trois lignes de décor pour annoncer une grille d'images. Sur
 * mobile, ces en-têtes occupaient à eux seuls le premier écran. Ici : un mot,
 * une taille de corps de texte, rien d'autre.
 */
function TitreSection({ id, children }: { id: string; children: React.ReactNode }) {
	return (
		<h2 id={id} className="mb-3 text-base font-bold text-foreground sm:text-lg">
			{children}
		</h2>
	);
}

export default async function IergDayPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const params = await searchParams;
	// ⚠ `parseSearchParams` renvoie `Math.max(1, parseInt(val, 10))`, donc `NaN` sur
	// `?page=abc`. Les requêtes normalisent déjà (`entierPositif`), mais transmettre
	// la valeur BRUTE au widget de pagination affichait le contenu de la page 1 sous
	// une pagination qui se croyait ailleurs : les deux flèches devenaient inertes
	// (`href="#"`) et les liens visaient les pages 1 et 11 au lieu de 2 et 3.
	// Une seule normalisation, en tête, pour la grille COMME pour le widget.
	const { page: pageBrute } = parseSearchParams(params);
	const pageCourante = entierPositif(pageBrute, 1);
	const slugDemande = lireSlug(params);

	const [campagne, campagnes] = await Promise.all([
		chargerCampagne(slugDemande),
		listerCampagnesPubliees(),
	]);

	// Aucune campagne publiée en base : on ne rend pas une grille cassée, on
	// explique l'état. C'est un état légitime (table vide juste après migration).
	if (!campagne) {
		return (
			<>
				<BreadcrumbSchema
					items={[
						{ item: "/", name: "Accueil" },
						{ item: "/iergday", name: "Campagnes" },
					]}
				/>
				<PageContainer className="space-y-8 py-6 sm:space-y-10">
					<PageHero
						eyebrow="Campagne communautaire"
						icon={<Hash className="size-6 text-rg-or" aria-hidden />}
						title="Mur communautaire"
						description="Les créations publiées sur X avec le hashtag d'une campagne Rose Griffon se retrouvent ici."
					/>
					<Empty className="rounded-3xl border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest py-10 sm:py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Hash className="size-8" aria-hidden />
							</EmptyMedia>
							<EmptyTitle>Aucune campagne publiée</EmptyTitle>
							<EmptyDescription>
								Aucune campagne n&apos;est ouverte au public pour le moment. Revenez bientôt&nbsp;:
								la prochaine opération de la communauté s&apos;affichera ici.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</PageContainer>
			</>
		);
	}

	const [stats, posts, enAvant, tailleAffiche, tailleReglement, depotDiscord] = await Promise.all([
		compterPostsCampagne(campagne.slug),
		listerPostsCampagne(campagne.slug, pageCourante, POSTS_PAR_PAGE),
		pageCourante === 1 ? listerPostsEnAvant(campagne.slug, 6) : Promise.resolve([]),
		// Les proportions RÉELLES des visuels, lues dans l'en-tête des fichiers.
		// Les deviner (un cadre carré, puis 3/4) bordait chaque document de bandes
		// vides ; les écrire en dur serait faux dès la campagne suivante, dont les
		// visuels seront téléversés par l'équipe sans passer par le code.
		dimensionsImage(campagne.imageAffiche),
		dimensionsImage(campagne.imageReglement),
		lienDepotDiscord(campagne.slug),
	]);

	const etat = etatCampagne(campagne);
	const periode = formaterPeriode(campagne);
	const hashtags = hashtagsAffichables(campagne);
	const hashtagPrincipal = campagne.hashtags[0] ?? "";
	const libelleHashtagPrincipal = hashtags[0]?.libelle ?? "";
	// Une autre campagne, déjà remplie, vers laquelle renvoyer si celle-ci est vide.
	const campagneDeRepli = campagnes.find((autre) => autre.slug !== campagne.slug) ?? null;
	// Distinguer « la campagne est vide » de « on a demandé une page qui n'existe pas ».
	const dernierePage = Math.max(1, Math.ceil(stats.posts / POSTS_PAR_PAGE));
	const pageHorsBornes = stats.posts > 0 && posts.length === 0;

	/*
	 * Il n'y a plus de sous-titre sous « Participer ». L'ancien annonçait « Les
	 * règles de la campagne, et le hashtag à ne pas oublier : #IERGDay » — deux
	 * informations déjà présentes à l'écran, la première sous forme de la liste
	 * numérotée juste dessous, la seconde dans le titre lui-même et dans la
	 * bannière. Le hashtag est désormais posé À CÔTÉ du titre, une fois.
	 */

	const rebours = choisirRebours(campagne, etat);

	return (
		<>
			<BreadcrumbSchema
				items={[
					{ item: "/", name: "Accueil" },
					{ item: "/iergday", name: "Campagnes" },
				]}
			/>

			<PageContainer className="space-y-8 py-6 sm:space-y-10">
				{/*
				 * ── PAS DE BANNIÈRE. TOUT EST SUR L'AFFICHE. ────────────────────────
				 *
				 * Elle répétait en texte ce que l'affiche dit déjà en toutes lettres
				 * juste dessous : le sur-titre, le titre, la consigne (« postez une
				 * image mettant en scène un OC »), la date de fin. Sur un téléphone,
				 * ces quatre lignes plus le fond décoratif occupaient le premier écran
				 * ENTIER — l'affiche, elle, commençait sous la ligne de flottaison.
				 *
				 * ⚠ LE TITRE N'EST PAS SUPPRIMÉ, IL EST RENDU AUX SEULS OUTILS QUI EN
				 * ONT BESOIN. Une page sans `<h1>` n'a pas de titre pour un lecteur
				 * d'écran ni pour un moteur de recherche, et le texte d'une image n'en
				 * tient pas lieu : aucun des deux ne lit les pixels. `sr-only` le garde
				 * dans le document sans le peindre.
				 */}
				<h1 className="sr-only">
					{campagne.surTitre ? `${campagne.surTitre} — ${campagne.titre}` : campagne.titre}
				</h1>

				{/* Les trois seules choses que l'affiche NE dit pas : le hashtag
				    copiable d'un geste, ce qui a déjà été déposé, et le temps qui
				    reste. */}
				<div className="space-y-3">
					<HashtagsCopiables hashtags={hashtags} />

					{etat !== "terminee" && (
						<>
							<BoutonsParticiper
								urlX={
									hashtagPrincipal
										? urlPublicationX(libelleHashtagPrincipal || hashtagPrincipal)
										: null
								}
								depotDiscord={depotDiscord}
								hashtag={libelleHashtagPrincipal || `#${hashtagPrincipal}`}
							/>
							{/* La seule voie qui demande un geste de plus : Instagram n'est
							    pas récoltable, le participant dépose donc lui-même. Replié
							    par défaut — c'est la voie minoritaire. */}
							<DepotInstagram slug={campagne.slug} />
						</>
					)}

					<div className="flex flex-wrap items-center gap-2">
						<Compteur
							icone={ImageIcon}
							valeur={String(stats.posts)}
							libelle={stats.posts > 1 ? "créations" : "création"}
						/>
						<Compteur
							icone={Users}
							valeur={String(stats.auteurs)}
							libelle={stats.auteurs > 1 ? "participants" : "participant"}
						/>
						{periode && (
							<span className="text-xs text-on-surface-variant">
								{periode}
								{etat === "a-venir" && " · pas encore commencé"}
								{etat === "terminee" && " · terminée"}
							</span>
						)}
					</div>

					{rebours && (
						<CompteARebours
							cibleIso={rebours.cibleIso}
							libelle={rebours.libelle}
							libelleEcoule={rebours.libelleEcoule}
							echeance={rebours.echeance}
						/>
					)}
				</div>

				{/*
				 * LES VISUELS, EN GRAND, AVANT TOUT LE RESTE — ET UNE SEULE FOIS.
				 *
				 * L'affiche et la carte des règles ne sont pas une illustration de la
				 * page : ce sont les documents officiels de la campagne, et ils portent
				 * les seules informations qu'un participant doit avoir (le hashtag, la
				 * date de fin, ce qui est autorisé). Ils étaient rendus DEUX FOIS — ici
				 * en grand, et de nouveau en vignettes de 226 px dans la colonne de
				 * « Comment participer », où rien de tout cela ne se lit. Le rappel a
				 * été supprimé : il n'ajoutait rien, et sa colonne restait à moitié
				 * vide sous le règlement d'à côté.
				 *
				 * Il n'y a plus de bannière au-dessus : elle recadrait cette même
				 * affiche en `object-cover` sous un voile marine à 90 %, c'est-à-dire
				 * en décor par construction illisible, tout en répétant son texte.
				 */}
				{(campagne.imageAffiche || campagne.imageReglement) && (
					<section aria-label="Visuels officiels de la campagne">
						{/* Pas de sous-titre « cliquez pour agrandir » : le pictogramme de
						    la vignette le dit déjà, et une phrase de plus au-dessus de
						    l'affiche, c'est l'affiche qui descend d'autant sur mobile. */}
						{/* Pas de titre : une affiche n'a pas besoin qu'on annonce que
						    c'en est une, et la ligne poussait le visuel d'autant plus bas
						    sur mobile. Le libellé de chaque vignette suffit à les
						    distinguer, et `aria-labelledby` est remplacé par un
						    `aria-label` puisqu'il n'y a plus d'élément à désigner. */}
						<VisuelsCampagne
							slug={campagne.slug}
							titreCampagne={campagne.titre}
							description={campagne.description}
							imageAffiche={campagne.imageAffiche}
							imageReglement={campagne.imageReglement}
							noteAffiche={campagne.noteAffiche}
							presentation="grand"
							tailleAffiche={tailleAffiche}
							tailleReglement={tailleReglement}
						/>
					</section>
				)}

				{/*
				 * ── PAS DE RÈGLEMENT EN TEXTE SUR LA PAGE ───────────────────────────
				 *
				 * Les trois règles et l'interdiction de l'IA étaient rendues en clair,
				 * numérotées, juste sous la carte « Règles » qui les écrit déjà — et
				 * qui est affichée en grand deux sections plus haut. C'était le même
				 * contenu deux fois sur un seul écran.
				 *
				 * ⚠ LE TEXTE N'EST PAS PERDU POUR AUTANT, et c'est ce qui rend le
				 * retrait acceptable : `VisuelsCampagne` passe `reglement` à la
				 * visionneuse en guise de LÉGENDE du document. Les règles restent donc
				 * lisibles par un lecteur d'écran, indexables, et sélectionnables — au
				 * clic sur la carte, là où l'on vient justement les lire. Les retirer
				 * SANS ce relais laisserait le règlement en pixels seulement, ce qu'un
				 * lecteur d'écran ne sait pas lire.
				 *
				 * La note de portée (« la galerie ne collecte pas Instagram ») a suivi
				 * le même chemin : elle est désormais SOUS le bouton Instagram, à
				 * l'endroit exact où elle sert.
				 */}

				{enAvant.length > 0 && (
					<section aria-labelledby="titre-a-la-une">
						<TitreSection id="titre-a-la-une">À la une</TitreSection>
						<CampagneGalerie posts={enAvant} />
					</section>
				)}

				<section aria-labelledby="titre-publications">
					<TitreSection id="titre-publications">
						Les créations
						{stats.posts > 0 && (
							<span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
								{stats.posts}
							</span>
						)}
					</TitreSection>

					{posts.length > 0 ? (
						<CampagneGalerie posts={posts} />
					) : pageHorsBornes ? (
						/*
						 * Page demandée au-delà de la dernière : la campagne A des
						 * publications, il ne faut donc surtout pas inviter à « publier sur X ».
						 * On le dit, et la pagination rendue plus bas ramène au début.
						 */
						<Empty className="rounded-3xl border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest py-10 sm:py-16">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Hash className="size-8" aria-hidden />
								</EmptyMedia>
								<EmptyTitle>Cette page n&apos;existe pas</EmptyTitle>
								<EmptyDescription>La galerie s&apos;arrête à la page {dernierePage}.</EmptyDescription>
							</EmptyHeader>
							<EmptyContent className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
								<Button asChild>
									<Link href={cheminCampagne(campagne)}>Retour à la première page</Link>
								</Button>
							</EmptyContent>
						</Empty>
					) : (
						/*
						 * Mur vide. Trois situations à ne pas confondre — une campagne
						 * terminée sans récolte ne doit surtout PAS inviter à publier, et
						 * une campagne ouverte mérite mieux qu'un « aucun post » laconique.
						 */
						<Empty className="rounded-3xl border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest py-10 sm:py-16">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									{etat === "terminee" ? (
										<Hash className="size-8" aria-hidden />
									) : (
										<Sparkles className="size-8" aria-hidden />
									)}
								</EmptyMedia>
								<EmptyTitle>
									{etat === "a-venir"
										? "La campagne n'a pas encore commencé"
										: etat === "terminee"
											? "Aucune publication n'a été collectée"
											: "Le mur attend sa première publication"}
								</EmptyTitle>
								<EmptyDescription>
									{etat === "terminee" ? (
										"Aucune création n'a été récoltée."
									) : libelleHashtagPrincipal ? (
										<>
											Publiez une image avec{" "}
											<strong className="text-on-surface">{libelleHashtagPrincipal}</strong> : elle
											arrive ici toute seule.
										</>
									) : (
										"Pas encore de hashtag publié."
									)}
								</EmptyDescription>
							</EmptyHeader>
							{/* `flex-wrap` : jusqu'à quatre actions ici, et une rangée figée
							    débordait de la carte dès 640 px. */}
							<EmptyContent className="flex flex-col flex-wrap items-center gap-3 sm:flex-row sm:justify-center">
								{etat !== "terminee" && hashtagPrincipal && (
									<>
										{/* Le libellé promet un écran de rédaction, la destination le
										    tient (`intent/post`). Le fil de recherche, lui, garde son
										    propre bouton juste à côté — le mur est vide, mais X ne
										    l'est peut-être pas encore à cette seconde. */}
										<Button asChild>
											<a
												href={urlPublicationX(libelleHashtagPrincipal || hashtagPrincipal)}
												target="_blank"
												rel="noopener noreferrer"
											>
												Publier sur X
											</a>
										</Button>
										<Button asChild variant="outline">
											<a
												href={urlRechercheX(hashtagPrincipal)}
												target="_blank"
												rel="noopener noreferrer"
											>
												Voir le fil sur X
											</a>
										</Button>
									</>
								)}
								{campagneDeRepli && (
									<Button asChild variant="link">
										<Link href={cheminCampagne(campagneDeRepli)}>
											Voir « {campagneDeRepli.titre} »
										</Link>
									</Button>
								)}
							</EmptyContent>
						</Empty>
					)}

					{/* La pagination vit HORS du ternaire : sinon une page hors bornes la
					    faisait disparaître et laissait le visiteur sans retour possible.

					    `currentPage` est BORNÉ à la dernière page réelle : `WikiPagination`
					    calcule ses liens à partir de ce numéro sans vérifier qu'ils existent,
					    donc sur `?page=99` la flèche « Précédent » pointait sur `?page=98`,
					    c'est-à-dire un autre écran vide. L'état « Cette page n'existe pas »
					    reste affiché (il dépend de `pageHorsBornes`, pas de ce numéro), mais
					    les trois contrôles visent enfin des pages qui existent. */}
					{stats.posts > 0 && (
						<div className="mt-12">
							<WikiPagination
								totalItems={stats.posts}
								itemsPerPage={POSTS_PAR_PAGE}
								currentPage={Math.min(pageCourante, dernierePage)}
							/>
						</div>
					)}
				</section>

				{/*
				 * LE SÉLECTEUR EN PIED, PAS EN TÊTE.
				 *
				 * Il affichait le titre de la campagne courante en pastille pleine —
				 * juste au-dessus de l'affiche, qui l'écrit déjà en gros. C'était le
				 * dernier doublon de texte de la page. Ce n'est pas un en-tête : c'est
				 * de la navigation VERS LES AUTRES campagnes, et sa place est là où
				 * l'on arrive quand on a fini de regarder celle-ci.
				 */}
				{campagnes.length > 1 && (
					<section aria-labelledby="titre-campagnes" className="border-t border-outline-variant/40 pt-6">
						<TitreSection id="titre-campagnes">Les autres campagnes</TitreSection>
						<SelecteurCampagne campagnes={campagnes} slugActif={campagne.slug} />
					</section>
				)}
			</PageContainer>
		</>
	);
}
