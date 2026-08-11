import Image from "next/image";

import { cn } from "@/lib/utils";

/*
 * Coque commune des pages institutionnelles (à propos, contact, rejoindre-rg,
 * charte d'engagements, nous soutenir, cellule de médiation, événements).
 *
 * Le motif était copié-collé — et dérivé — d'une page à l'autre : largeurs
 * maximales différentes (`container`, `max-w-5xl`, `max-w-6xl`), gouttières
 * différentes (`px-2`, `px-4`, `px-6`), bannières de marque toutes repeintes à
 * la main en hexadécimal. Ces quatre briques figent le motif une seule fois.
 *
 * Aucune couleur en dur ici : uniquement les tokens du design system
 * (`bg-card`, `border-border`, `text-muted-foreground`) et les tokens de marque
 * Rose Griffon (`rg-marine`, `rg-brique`, `rg-or`, `rg-sur-marine`), qui sont
 * volontairement constants d'un thème à l'autre.
 */

/**
 * Habillage des boutons posés SUR la bannière de marque. Le `Button` partagé
 * suppose un fond d'interface ; sur le dégradé marine ses variantes `default`
 * (primaire sombre) et `outline` (fond `background`) passent sous le seuil de
 * contraste. Ces deux classes le rétablissent avec les seuls tokens de marque —
 * à passer en `className` du `Button`, jamais à réécrire à la main.
 *
 * `whitespace-normal` + `h-auto min-h-12` : le `Button` partagé impose
 * `whitespace-nowrap`, ce qui fait déborder un libellé long dès 320 px.
 */
const heroButtonBase =
	"h-auto min-h-12 rounded-full px-5 py-3 text-center text-base font-bold whitespace-normal sm:px-6";
export const heroPrimaryButtonClass = `${heroButtonBase} bg-rg-or text-rg-marine hover:bg-rg-or/90`;
export const heroSecondaryButtonClass = `${heroButtonBase} border border-rg-or/60 bg-rg-sur-marine/10 text-rg-sur-marine backdrop-blur-sm hover:border-rg-or hover:bg-rg-sur-marine/20 hover:text-rg-sur-marine`;

/** Conteneur de page — même largeur maximale et mêmes gouttières que la home. */
export function PageContainer({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn("mx-auto w-full max-w-7xl space-y-12 px-4 py-8 md:px-6 lg:px-8", className)}
		>
			{children}
		</div>
	);
}

/**
 * Bannière de marque en tête de page — dégradé marine → brique, texte blanc
 * cassé, accents or. Volontairement identique dans les quatre thèmes : c'est
 * une surface de marque, pas une surface d'interface.
 */
export function PageHero({
	eyebrow,
	icon,
	title,
	description,
	actions,
	image,
	children,
}: {
	/** Sur-titre court (ex. « Association loi 1901 »). */
	eyebrow?: React.ReactNode;
	/** Icône décorative affichée devant le sur-titre. */
	icon?: React.ReactNode;
	title: React.ReactNode;
	description?: React.ReactNode;
	/** Zone d'actions — un contrôle donné ne doit exister qu'une fois par écran. */
	actions?: React.ReactNode;
	/**
	 * Photo de fond optionnelle. Le dégradé de marque est alors appliqué
	 * par-dessus, à opacité quasi pleine : le texte garde son contraste quelle
	 * que soit la photo, et la bannière reste reconnaissable.
	 */
	image?: { src: string };
	children?: React.ReactNode;
}) {
	return (
		<section
			className={cn(
				"relative overflow-hidden rounded-3xl p-6 shadow-2xl xs:p-8 md:p-12 lg:p-16",
				!image && "bg-linear-to-br from-rg-marine via-rg-marine-clair to-rg-brique"
			)}
		>
			{image && (
				<>
					{/* `alt` vide : l'image est purement décorative, le titre porte le sens. */}
					<Image
						src={image.src}
						alt=""
						fill
						sizes="100vw"
						priority
						className="object-cover"
						aria-hidden
					/>
					<div
						className="absolute inset-0 bg-linear-to-br from-rg-marine/95 via-rg-marine-clair/90 to-rg-brique/90"
						aria-hidden
					/>
				</>
			)}
			{/* Texture partagée par toutes les bannières (asset, pas une couleur). */}
			<div
				className="pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
				style={{ backgroundImage: "url(/images/noise.svg)" }}
				aria-hidden
			/>
			<div className="relative z-10">
				{(eyebrow || icon) && (
					<div className="mb-4 flex items-center gap-3">
						{icon}
						{eyebrow && (
							<span className="text-xs font-semibold tracking-wide text-rg-or uppercase sm:text-sm md:text-base">
								{eyebrow}
							</span>
						)}
					</div>
				)}
				<h1 className="mb-4 text-fluid-display-lg font-bold tracking-tight text-rg-sur-marine md:mb-6">
					{title}
				</h1>
				{description && (
					<p className="max-w-3xl text-fluid-body-lg leading-relaxed text-rg-sur-marine/85">
						{description}
					</p>
				)}
				{actions && <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>}
				{children}
			</div>
		</section>
	);
}

/** En-tête de section : pastille d'icône + titre + sous-titre + action. */
export function SectionHeading({
	icon,
	iconClassName,
	title,
	subtitle,
	action,
	id,
}: {
	icon?: React.ReactNode;
	/** Couleurs de la pastille — tokens uniquement (`bg-primary text-primary-foreground`…). */
	iconClassName?: string;
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	action?: React.ReactNode;
	id?: string;
}) {
	return (
		<div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
			<div className="flex items-center gap-3">
				{icon && <div className={cn("rounded-lg p-2 shadow-lg", iconClassName)}>{icon}</div>}
				<div>
					<h2 id={id} className="text-fluid-headline-lg font-bold text-foreground">
						{title}
					</h2>
					{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
				</div>
			</div>
			{action}
		</div>
	);
}

/** Carte de section : surface thématisée, jamais un blanc codé en dur. */
export function SectionCard({
	children,
	className,
	id,
}: {
	children: React.ReactNode;
	className?: string;
	id?: string;
}) {
	return (
		<section
			id={id}
			className={cn(
				"scroll-mt-24 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl transition-shadow duration-300 hover:shadow-2xl",
				className
			)}
		>
			{children}
		</section>
	);
}
