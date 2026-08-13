import {
	Button,
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@rosegriffon/ui";
import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import {
	CalendarRange,
	ClipboardList,
	Hash,
	ImageIcon,
	Info,
	Sparkles,
	Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
	heroPrimaryButtonClass,
	heroSecondaryButtonClass,
	PageContainer,
	PageHero,
	SectionHeading,
} from "@/components/shared/PageShell";
import { BreadcrumbSchema } from "@/components/shared/StructuredData";
import { WikiPagination } from "@/components/shared/WikiPagination";
import { parseSearchParams } from "@/lib/validations";
import {
	chargerCampagne,
	compterPostsCampagne,
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
	listerEnFrancais,
	reseauxHorsX,
	urlPublicationX,
	urlRechercheX,
} from "@/lib/x-campagnes/types";

import { CampagneGalerie } from "./CampagneGalerie";
import { CompteARebours } from "./CompteARebours";
import { HashtagsCopiables } from "./HashtagsCopiables";
import { ReglementCampagne } from "./ReglementCampagne";
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
 * Compteur de la bannière — même gabarit pour les trois, aucune couleur en dur.
 *
 * ⚠ NI LA VALEUR NI LE LIBELLÉ NE SONT COUPÉS. La valeur affiche parfois une
 * durée (« 22 minutes ») et non un nombre : couper « 22 minu… » serait pire que
 * de la laisser passer à la ligne. Le libellé, lui, portait encore `truncate` et
 * sautait au point de rupture même que la DA vise : à 375 px, en
 * `xs:grid-cols-2`, il ne reste qu'une centaine de pixels et l'écran affichait
 * « publications a… », « depuis la der… » (mesuré : −38 % et −40 %). Les deux
 * passent donc à la ligne, la tuile s'adapte en hauteur.
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
		<div className="flex items-center gap-3 rounded-2xl border border-rg-or/40 bg-rg-sur-marine/10 px-4 py-3 backdrop-blur-sm">
			<Icone className="size-5 shrink-0 text-rg-or" aria-hidden />
			<div className="min-w-0">
				<p className="text-fluid-headline-md font-bold leading-tight break-words text-rg-sur-marine">
					{valeur}
				</p>
				<p className="text-xs leading-tight text-rg-sur-marine/80">{libelle}</p>
			</div>
		</div>
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
				<PageContainer>
					<PageHero
						eyebrow="Campagne communautaire"
						icon={<Hash className="size-6 text-rg-or" aria-hidden />}
						title="Mur communautaire"
						description="Les créations publiées sur X avec le hashtag d'une campagne Rose Griffon se retrouvent ici."
					/>
					<Empty className="rounded-[32px] border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest py-20">
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

	const [stats, posts, enAvant] = await Promise.all([
		compterPostsCampagne(campagne.slug),
		listerPostsCampagne(campagne.slug, pageCourante, POSTS_PAR_PAGE),
		pageCourante === 1 ? listerPostsEnAvant(campagne.slug, 6) : Promise.resolve([]),
	]);

	const etat = etatCampagne(campagne);
	const periode = formaterPeriode(campagne);
	const hashtags = hashtagsAffichables(campagne);
	const hashtagPrincipal = campagne.hashtags[0] ?? "";
	const libelleHashtagPrincipal = hashtags[0]?.libelle ?? "";
	const collecte = campagne.collecteLe ? new Date(campagne.collecteLe) : null;
	const collecteValide = collecte && !Number.isNaN(collecte.getTime()) ? collecte : null;
	// Une autre campagne, déjà remplie, vers laquelle renvoyer si celle-ci est vide.
	const campagneDeRepli = campagnes.find((autre) => autre.slug !== campagne.slug) ?? null;
	// Distinguer « la campagne est vide » de « on a demandé une page qui n'existe pas ».
	const dernierePage = Math.max(1, Math.ceil(stats.posts / POSTS_PAR_PAGE));
	const pageHorsBornes = stats.posts > 0 && posts.length === 0;

	// Ce que la page a d'autre à montrer qu'une grille : les documents officiels.
	const aReglement = campagne.reglement.length > 0;
	const aVisuels = Boolean(campagne.imageAffiche || campagne.imageReglement);
	const aParticipation = aReglement || aVisuels;
	// Réseaux, autres que X, que le règlement de CETTE campagne accepte.
	const reseauxAutres = reseauxHorsX(campagne.reglement);
	/*
	 * Sous-titre de « Comment participer ». Il ne doit RIEN annoncer que le
	 * règlement rendu vingt pixels plus bas contredit : « Une image, le hashtag, et
	 * c'est tout » était faux pour IERG Day, dont la règle 1 exige une mise en scène
	 * d'OC et la règle 4 interdit l'IA. Le seul résumé honnête d'un règlement qu'on
	 * ne connaît pas à l'avance, c'est de dire qu'il y en a un.
	 */
	const sousTitreParticipation = aReglement
		? `Les règles de la campagne${libelleHashtagPrincipal ? `, et le hashtag à ne pas oublier : ${libelleHashtagPrincipal}` : ""}.`
		: libelleHashtagPrincipal
			? `Le hashtag à ne pas oublier : ${libelleHashtagPrincipal}.`
			: undefined;

	const rebours = choisirRebours(campagne, etat);

	return (
		<>
			<BreadcrumbSchema
				items={[
					{ item: "/", name: "Accueil" },
					{ item: "/iergday", name: "Campagnes" },
				]}
			/>

			<PageContainer>
				<PageHero
					eyebrow={campagne.surTitre ?? "Campagne communautaire"}
					icon={<Hash className="size-6 text-rg-or" aria-hidden />}
					title={campagne.titre}
					description={campagne.description ?? undefined}
					image={campagne.imageCouverture ? { src: campagne.imageCouverture } : undefined}
					actions={
						etat !== "terminee" && hashtagPrincipal ? (
							<>
								{/* « Participer », c'est PUBLIER : `intent/post` ouvre la fenêtre de
								    rédaction de X, hashtag déjà saisi. Ce bouton menait au fil de
								    recherche — c'est-à-dire, pour une campagne qui vient d'être
								    annoncée, à un écran vide. */}
								<Button asChild className={heroPrimaryButtonClass}>
									<a
										href={urlPublicationX(libelleHashtagPrincipal || hashtagPrincipal)}
										target="_blank"
										rel="noopener noreferrer"
									>
										Participer sur X
									</a>
								</Button>
								{aParticipation ? (
									<Button asChild variant="ghost" className={heroSecondaryButtonClass}>
										<Link href="#participer">Lire les règles</Link>
									</Button>
								) : (
									<Button asChild variant="ghost" className={heroSecondaryButtonClass}>
										<Link href="/community">Découvrir la communauté</Link>
									</Button>
								)}
							</>
						) : undefined
					}
				>
					<HashtagsCopiables hashtags={hashtags} />

					{rebours && (
						<CompteARebours
							cibleIso={rebours.cibleIso}
							libelle={rebours.libelle}
							libelleEcoule={rebours.libelleEcoule}
							echeance={rebours.echeance}
						/>
					)}

					<div className="mt-6 grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-3">
						<Compteur
							icone={ImageIcon}
							valeur={String(stats.posts)}
							libelle={stats.posts > 1 ? "publications avec image" : "publication avec image"}
						/>
						<Compteur
							icone={Users}
							valeur={String(stats.auteurs)}
							libelle={stats.auteurs > 1 ? "participants" : "participant"}
						/>
						{/* Durée SANS « il y a » (`Strict`, pas `addSuffix`) : la valeur d'un
						    compteur doit tenir sur une ligne à 375 px, et le libellé porte
						    déjà le sens (« depuis la dernière récolte »). */}
						<Compteur
							icone={CalendarRange}
							valeur={
								collecteValide ? formatDistanceToNowStrict(collecteValide, { locale: fr }) : "Jamais"
							}
							libelle={collecteValide ? "depuis la dernière récolte" : "aucune récolte à ce jour"}
						/>
					</div>

					{periode && (
						<p className="mt-4 text-sm text-rg-sur-marine/80">
							{periode}
							{etat === "a-venir" && " · la campagne n'a pas encore commencé"}
							{etat === "terminee" && " · campagne terminée"}
						</p>
					)}
				</PageHero>

				<SelecteurCampagne campagnes={campagnes} slugActif={campagne.slug} />

				{/*
				 * « Comment participer » AVANT la galerie : quand la campagne est ouverte
				 * et que le mur est encore vide, c'est la seule chose qui a de la valeur
				 * pour le visiteur. Les campagnes archivées n'ont pas de règlement en
				 * base : la section ne s'affiche tout simplement pas pour elles.
				 */}
				{aParticipation && (
					<section id="participer" aria-labelledby="titre-participer" className="scroll-mt-24">
						<SectionHeading
							id="titre-participer"
							icon={<ClipboardList className="size-5" aria-hidden />}
							iconClassName="bg-primary text-on-primary"
							title="Comment participer"
							subtitle={sousTitreParticipation}
						/>

						<div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
							<div className="space-y-4">
								<ReglementCampagne reglement={campagne.reglement} />

								{/*
								 * Ce que le mur collecte VRAIMENT. Le règlement autorise plusieurs
								 * réseaux, la récolte n'en interroge qu'un (`hashtag-harvest.ts`
								 * interroge X, et il n'existe aucun collecteur Instagram ici).
								 * Laisser croire qu'une participation Instagram apparaîtra dans
								 * cette galerie serait un mensonge — la liste des réseaux est lue
								 * dans le règlement, pas écrite en dur.
								 */}
								<div className="flex items-start gap-3 rounded-2xl border border-outline-variant/60 bg-surface-container-low p-4">
									<Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
									<p className="text-sm leading-relaxed text-on-surface-variant">
										{reseauxAutres.length > 0 ? (
											<>
												Le règlement accepte aussi {listerEnFrancais(reseauxAutres)}.{" "}
												<strong className="font-semibold text-on-surface">
													Ce mur ne collecte que&nbsp;X
												</strong>{" "}
												: une création publiée sur {listerEnFrancais(reseauxAutres)} compte pour
												la campagne, mais elle n&apos;apparaîtra pas dans cette galerie.
											</>
										) : (
											<>
												Ce mur ne collecte que les publications X
												{libelleHashtagPrincipal ? ` portant ${libelleHashtagPrincipal}` : ""}.
											</>
										)}
									</p>
								</div>
							</div>

							<VisuelsCampagne
								slug={campagne.slug}
								titreCampagne={campagne.titre}
								description={campagne.description}
								reglement={campagne.reglement}
								imageAffiche={campagne.imageAffiche}
								imageReglement={campagne.imageReglement}
								noteAffiche={campagne.noteAffiche}
							/>
						</div>
					</section>
				)}

				{enAvant.length > 0 && (
					<section aria-labelledby="titre-a-la-une">
						<SectionHeading
							id="titre-a-la-une"
							icon={<Sparkles className="size-5" aria-hidden />}
							iconClassName="bg-primary text-on-primary"
							title="À la une"
							subtitle="Les créations mises en avant par l'équipe."
						/>
						<CampagneGalerie posts={enAvant} />
					</section>
				)}

				<section aria-labelledby="titre-publications">
					<SectionHeading
						id="titre-publications"
						icon={<ImageIcon className="size-5" aria-hidden />}
						iconClassName="bg-primary text-on-primary"
						title="Les publications"
						subtitle={
							stats.posts > 0
								? `${stats.posts} publication${stats.posts > 1 ? "s" : ""} avec image, de la plus récente à la plus ancienne.`
								: undefined
						}
					/>

					{posts.length > 0 ? (
						<CampagneGalerie posts={posts} />
					) : pageHorsBornes ? (
						/*
						 * Page demandée au-delà de la dernière : la campagne A des
						 * publications, il ne faut donc surtout pas inviter à « publier sur X ».
						 * On le dit, et la pagination rendue plus bas ramène au début.
						 */
						<Empty className="rounded-[32px] border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest py-20">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Hash className="size-8" aria-hidden />
								</EmptyMedia>
								<EmptyTitle>Cette page n&apos;existe pas</EmptyTitle>
								<EmptyDescription>
									La galerie s&apos;arrête à la page {dernierePage}. Revenez au début pour
									parcourir les publications.
								</EmptyDescription>
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
						<Empty className="rounded-[32px] border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest py-20">
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
										"Cette campagne est close et aucune publication n'a été récoltée pour elle."
									) : libelleHashtagPrincipal ? (
										<>
											Publiez une image sur X avec{" "}
											<strong className="text-on-surface">{libelleHashtagPrincipal}</strong> : elle
											rejoindra cette galerie automatiquement, sans rien demander à personne.
										</>
									) : (
										"Cette campagne n'a pas encore de hashtag publié."
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
								{etat !== "terminee" && aParticipation && (
									<Button asChild variant="outline">
										<Link href="#participer">Relire les règles</Link>
									</Button>
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
			</PageContainer>
		</>
	);
}
