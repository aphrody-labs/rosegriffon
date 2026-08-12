"use client";

import { AspectRatio, Badge, Card } from "@rosegriffon/ui";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ExternalLink, Heart, ImageIcon, MessageCircle, Repeat2 } from "lucide-react";
import Image from "next/image";

import {
	afficherHashtag,
	extraitTexte,
	formaterNombre,
	type PostCampagne,
	urlPostX,
} from "@/lib/x-campagnes/types";

/*
 * Carte d'une publication de campagne — purement présentationnelle.
 *
 * Ne reçoit que des données sérialisables (`PostCampagne`) et deux primitives :
 * aucun accès base, aucun import de `queries.ts`.
 *
 * ⚠ `FrenchTweet.tsx` / `FeaturedTweets.tsx` sont des CONTRE-EXEMPLES : ils
 * peignent les métriques avec le bleu hexadécimal de X et un rose Tailwind en
 * dur. Ici tout passe par les tokens (`text-on-surface-variant`, `text-primary`).
 */

/*
 * Le `sizes` doit décrire la grille réelle 1 → 4 colonnes, sinon Next sert du
 * 100vw partout.
 *
 * ⚠ Les bornes sont à UN PIXEL SOUS les points de rupture, jamais dessus : une
 * `media query` Tailwind est un `min-width` (`xs` = 375px, `lg` = 1024px,
 * `xl` = 1280px), donc à 375px exactement la grille est DÉJÀ à deux colonnes.
 * Écrire `(max-width: 375px) 100vw` faisait demander une image pleine largeur
 * pour une vignette de demi-largeur — du sur-téléchargement pur à ces trois
 * largeurs précises.
 */
const TAILLES_VIGNETTE =
	"(max-width: 374px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw";

/*
 * Indicateur de focus clavier de la vignette : une `outline` à décalage NÉGATIF,
 * surtout pas un `ring`.
 *
 * `focus-visible:ring-4` compile en `box-shadow` tracé À L'EXTÉRIEUR de la boîte
 * (`--tw-ring-shadow: 0 0 0 calc(4px + …)`), or la `Card` parente porte
 * `overflow-hidden` : l'anneau était donc intégralement rogné — et le
 * `outline-hidden` qui l'accompagnait avait en plus supprimé l'anneau natif du
 * navigateur. Résultat : plus aucun repère au clavier (WCAG 2.4.7).
 * Une `outline` négative reste dans la zone de rognage et, d'après l'ordre de
 * peinture CSS, passe au-dessus de l'image de la vignette.
 */
const FOCUS_VIGNETTE =
	"focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-primary";

/*
 * Lien « Voir sur X ». `min-h-11` (44 px) comme TOUTES les autres cibles de la
 * page : le `min-h-8` d'origine passait bien le minimum WCAG 2.5.8 (24 px), mais
 * en faisait la seule cible plus petite que les autres sous le doigt.
 */
const LIEN_VERS_X =
	"inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function Metrique({
	icone: Icone,
	valeur,
	libelle,
}: {
	icone: typeof Heart;
	valeur: number | undefined;
	libelle: string;
}) {
	if (!valeur) {
		return null;
	}
	// Pas de `title` : plusieurs lecteurs d'écran annoncent l'infobulle EN PLUS du
	// texte `sr-only`, ce qui donne « 12 j'aime … j'aime ». Le libellé masqué suffit,
	// et il reste lisible par tous puisque le nombre est déjà affiché.
	return (
		<span className="inline-flex items-center gap-1">
			<Icone className="size-3.5" aria-hidden />
			<span>{formaterNombre(valeur)}</span>
			<span className="sr-only">{libelle}</span>
		</span>
	);
}

export function PostCarte({
	post,
	priorite,
	onOuvrir,
}: {
	post: PostCampagne;
	/** `priority` de `next/image` — réservé aux premières vignettes visibles. */
	priorite: boolean;
	onOuvrir: () => void;
}) {
	const image = post.images[0];
	const extrait = extraitTexte(post.texte, 160);
	const date = post.publieLe ? new Date(post.publieLe) : null;
	const dateValide = date && !Number.isNaN(date.getTime()) ? date : null;

	return (
		<Card className="group w-full flex-1 gap-0 overflow-hidden rounded-[24px] border-2 border-rg-or/40 bg-surface-container-low py-0 shadow-[0_4px_0_0_rgba(0,0,0,0.5)] transition-transform duration-300 motion-safe:hover:-translate-y-1">
			<button
				type="button"
				onClick={onOuvrir}
				aria-label={`Agrandir la publication de @${post.auteurPseudo}`}
				className={`relative block w-full cursor-zoom-in overflow-hidden ${FOCUS_VIGNETTE}`}
			>
				<AspectRatio ratio={4 / 5}>
					{image ? (
						<Image
							src={image.src}
							alt={`Image publiée sur X par @${post.auteurPseudo}`}
							fill
							sizes={TAILLES_VIGNETTE}
							quality={70}
							priority={priorite}
							className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
						/>
					) : (
						/* Pictogramme de repli à pleine opacité : `text-on-surface-variant/60`
						   sur `bg-surface-container-high` tombe à 2,2:1, sous le 3:1 exigé
						   pour un élément graphique porteur de sens (WCAG 1.4.11). */
						<div className="flex size-full items-center justify-center bg-surface-container-high text-on-surface-variant">
							<ImageIcon className="size-10" aria-hidden />
						</div>
					)}
				</AspectRatio>

				{post.images.length > 1 && (
					<Badge
						variant="secondary"
						className="absolute right-2 top-2 border-2 border-rg-or/50 shadow-[0_2px_0_0_rgba(0,0,0,0.4)]"
					>
						+{post.images.length - 1}
					</Badge>
				)}
				{post.misEnAvant && (
					<Badge className="absolute left-2 top-2 border-2 border-rg-or/50 shadow-[0_2px_0_0_rgba(0,0,0,0.4)]">
						À la une
					</Badge>
				)}
			</button>

			<div className="flex flex-1 flex-col gap-2 p-4">
				<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
					<span className="truncate text-sm font-bold text-on-surface">{post.auteurNom}</span>
					<span className="truncate text-xs text-on-surface-variant">@{post.auteurPseudo}</span>
				</div>

				{dateValide && (
					<time dateTime={dateValide.toISOString()} className="text-xs text-on-surface-variant">
						{formatDistanceToNow(dateValide, { addSuffix: true, locale: fr })}
					</time>
				)}

				{extrait && (
					<p className="line-clamp-3 text-sm leading-relaxed text-on-surface-variant">{extrait}</p>
				)}

				<div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
					<div className="flex items-center gap-3 text-xs text-on-surface-variant">
						<Metrique icone={Heart} valeur={post.metriques?.like_count} libelle="j'aime" />
						<Metrique icone={Repeat2} valeur={post.metriques?.retweet_count} libelle="repartages" />
						<Metrique
							icone={MessageCircle}
							valeur={post.metriques?.reply_count}
							libelle="réponses"
						/>
					</div>

					<a
						href={urlPostX(post.auteurPseudo, post.tweetId)}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={`Voir la publication de @${post.auteurPseudo} sur X (nouvel onglet)`}
						className={LIEN_VERS_X}
					>
						Voir sur X
						<ExternalLink className="size-3.5" aria-hidden />
					</a>
				</div>

				{/* `text-primary` et non `text-rg-or` : l'or de marque est lisible sur le
				    dégradé marine de la bannière, pas sur une surface d'interface claire. */}
				{post.hashtagTrouve && (
					<span className="text-xs font-semibold text-primary">
						{afficherHashtag(post.hashtagTrouve)}
					</span>
				)}
			</div>
		</Card>
	);
}
