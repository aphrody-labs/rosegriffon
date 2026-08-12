import {
	Badge,
	Button,
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@rosegriffon/ui";
import { format, formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarRange, Hash, ImageIcon, Sparkles, Users } from "lucide-react";
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
	afficherHashtag,
	type Campagne,
	entierPositif,
	etatCampagne,
	urlRechercheX,
} from "@/lib/x-campagnes/types";

import { CampagneGalerie } from "./CampagneGalerie";
import { SelecteurCampagne } from "./SelecteurCampagne";

/*
 * Mur communautaire des campagnes à hashtag X.
 *
 * La page n'est PAS figée sur `#IERGDay` : la campagne affichée est celle qui
 * porte `principale` en base, et `?campagne=<slug>` permet de consulter les
 * autres. Lancer, arrêter ou changer la campagne à la une = un `UPDATE`, jamais
 * un déploiement.
 *
 * `force-dynamic` + `revalidate = 0` : la galerie se remplit au fil de la
 * récolte, et `await searchParams` rend de toute façon la route dynamique
 * (même couple que `app/admin/patreon/page.tsx`).
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const POSTS_PAR_PAGE = 24;
const URL_CANONIQUE = "https://rosegriffon.fr/iergday";

/** Lit `?campagne=` sans toucher au schéma partagé `parseSearchParams`. */
function lireSlug(params: Record<string, string | string[] | undefined>): string | undefined {
	const brut = params.campagne;
	return typeof brut === "string" && brut.trim() ? brut.trim() : undefined;
}

/** Période éditoriale en français (« du 5 au 31 août 2026 », « depuis le 1er octobre »…). */
function formaterPeriode(campagne: Campagne): string | null {
	const debut = campagne.debutLe ? new Date(campagne.debutLe) : null;
	const fin = campagne.finLe ? new Date(campagne.finLe) : null;
	if (debut && fin) {
		return `Du ${format(debut, "d MMMM yyyy", { locale: fr })} au ${format(fin, "d MMMM yyyy", { locale: fr })}`;
	}
	if (debut) {
		return `Depuis le ${format(debut, "d MMMM yyyy", { locale: fr })}`;
	}
	if (fin) {
		return `Jusqu'au ${format(fin, "d MMMM yyyy", { locale: fr })}`;
	}
	return null;
}

export async function generateMetadata({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
	const campagne = await chargerCampagne(lireSlug(await searchParams));
	const titre = campagne ? `${campagne.titre} | Rose Griffon` : "Campagnes communautaires | Rose Griffon";
	const description =
		campagne?.description?.slice(0, 160) ??
		"Les créations de la communauté Inazuma Eleven publiées sur X pour les campagnes à hashtag de l'association Rose Griffon.";

	return {
		alternates: { canonical: URL_CANONIQUE },
		description,
		openGraph: {
			description,
			images: [
				{
					alt: campagne ? `${campagne.titre} — Rose Griffon` : "Campagnes communautaires Rose Griffon",
					height: 630,
					url: "/opengraph-image.png",
					width: 1200,
				},
			],
			title: titre,
			type: "website",
			url: URL_CANONIQUE,
		},
		title: titre,
		twitter: { card: "summary_large_image" },
	};
}

/**
 * Compteur de la bannière — même gabarit pour les trois, aucune couleur en dur.
 *
 * ⚠ La valeur porte `break-words leading-tight` et JAMAIS `truncate` : la
 * troisième tuile affiche une durée (« 22 minutes »), pas un nombre, et couper
 * « 22 minu… » serait pire que de la laisser passer à la ligne. À 375 px en
 * `xs:grid-cols-2` il ne reste qu'une centaine de pixels de texte : sans
 * `break-words`, un mot long déborderait de la tuile.
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
				<p className="truncate text-xs text-rg-sur-marine/80">{libelle}</p>
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
	const hashtagPrincipal = campagne.hashtags[0] ?? "";
	const collecte = campagne.collecteLe ? new Date(campagne.collecteLe) : null;
	const collecteValide = collecte && !Number.isNaN(collecte.getTime()) ? collecte : null;
	// Une autre campagne, déjà remplie, vers laquelle renvoyer si celle-ci est vide.
	const campagneDeRepli = campagnes.find((autre) => autre.slug !== campagne.slug) ?? null;
	// Distinguer « la campagne est vide » de « on a demandé une page qui n'existe pas ».
	const dernierePage = Math.max(1, Math.ceil(stats.posts / POSTS_PAR_PAGE));
	const pageHorsBornes = stats.posts > 0 && posts.length === 0;

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
								<Button asChild className={heroPrimaryButtonClass}>
									<a
										href={urlRechercheX(hashtagPrincipal)}
										target="_blank"
										rel="noopener noreferrer"
									>
										Participer sur X
									</a>
								</Button>
								<Button asChild variant="ghost" className={heroSecondaryButtonClass}>
									<Link href="/community">Découvrir la communauté</Link>
								</Button>
							</>
						) : undefined
					}
				>
					<div className="mt-6 flex flex-wrap gap-2">
						{campagne.hashtags.map((hashtag) => (
							<Badge
								key={hashtag}
								variant="outline"
								className="border-rg-or/60 bg-rg-sur-marine/10 text-rg-sur-marine"
							>
								{afficherHashtag(hashtag)}
							</Badge>
						))}
					</div>

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
									<Link href={campagne.principale ? "/iergday" : `/iergday?campagne=${campagne.slug}`}>
										Retour à la première page
									</Link>
								</Button>
							</EmptyContent>
						</Empty>
					) : (
						<Empty className="rounded-[32px] border-2 border-dashed border-outline-variant/40 bg-surface-container-lowest py-20">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Hash className="size-8" aria-hidden />
								</EmptyMedia>
								<EmptyTitle>
									{etat === "a-venir"
										? "La campagne n'a pas encore commencé"
										: "Aucune publication pour le moment"}
								</EmptyTitle>
								<EmptyDescription>
									{hashtagPrincipal ? (
										<>
											Publiez une image sur X avec{" "}
											<strong className="text-on-surface">
												{afficherHashtag(hashtagPrincipal)}
											</strong>{" "}
											: elle rejoindra cette galerie automatiquement, sans rien demander à
											personne.
										</>
									) : (
										"Cette campagne n'a pas encore de hashtag publié."
									)}
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
								{etat !== "terminee" && hashtagPrincipal && (
									<Button asChild>
										<a
											href={urlRechercheX(hashtagPrincipal)}
											target="_blank"
											rel="noopener noreferrer"
										>
											Publier sur X
										</a>
									</Button>
								)}
								{campagneDeRepli && (
									<Button asChild variant="link">
										<Link
											href={
												campagneDeRepli.principale
													? "/iergday"
													: `/iergday?campagne=${campagneDeRepli.slug}`
											}
										>
											Voir « {campagneDeRepli.titre} »
										</Link>
									</Button>
								)}
							</EmptyContent>
						</Empty>
					)}

					{/* La pagination vit HORS du ternaire : sinon une page hors bornes la
					    faisait disparaître et laissait le visiteur sans retour possible. */}
					{stats.posts > 0 && (
						<div className="mt-12">
							<WikiPagination
								totalItems={stats.posts}
								itemsPerPage={POSTS_PAR_PAGE}
								currentPage={pageCourante}
							/>
						</div>
					)}
				</section>
			</PageContainer>
		</>
	);
}
