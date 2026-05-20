import {
	ChevronRight,
	ExternalLink,
	Eye,
	Heart,
	Megaphone,
	Sparkles,
	Trophy,
	Users,
} from "lucide-react";
import type { Metadata } from "next";

import { PublicTiers } from "@/components/patreon/PublicTiers";

export const metadata: Metadata = {
	description:
		"Rose Griffon est porté par sa communauté. Soutenez l'association via Patreon (mensuel) ou PayPal (don ponctuel). Transparence garantie.",
	title: "Nous soutenir · Rose Griffon",
};

export const dynamic = "force-dynamic";

const SUPPORT_OPTIONS = [
	{
		cta: "Devenir mécène",
		desc: "Rejoignez nos mécènes sur Patreon pour un soutien régulier. Accédez à des contenus exclusifs, des coulisses et participez activement à la vie de l'association.",
		external: true,
		href: "https://patreon.com/RoseGriffon",
		key: "patreon",
		subtitle: "Mécénat récurrent",
		title: "Soutien mensuel via Patreon",
		variant: "primary" as const,
	},
	{
		cta: "Faire un don",
		desc: "Vous souhaitez faire un don unique pour soutenir nos actions ? PayPal vous permet de contribuer facilement et en toute sécurité, quel que soit le montant.",
		external: true,
		href: "https://www.paypal.com/paypalme/rosegriffon",
		key: "paypal",
		subtitle: "Coup de main one-shot",
		title: "Don ponctuel via PayPal",
		variant: "secondary" as const,
	},
];

const WHY_CARDS = [
	{
		desc: "Articles, chroniques, lives, événements — tout ce contenu est gratuit pour la communauté grâce à vos soutiens.",
		icon: Megaphone,
		title: "Faire vivre Inazuma Eleven en France",
	},
	{
		desc: "Achilléa fait grandir l'e-sport IE en France. Tournois, coaching, format — tout ça coûte du temps et du matos.",
		icon: Trophy,
		title: "Une scène compétitive structurée",
	},
	{
		desc: "Tous les contributeurs RG sont bénévoles. Vos dons financent les outils, l'infra, le matos — pas les salaires.",
		icon: Users,
		title: "Une équipe de bénévoles",
	},
];

const TRANSPARENCY = [
	{
		desc: "Tournois, conventions, rencontres physiques. Coût matériel, lots, déplacements.",
		icon: Trophy,
		title: "Événements communautaires",
	},
	{
		desc: "Azalée (chroniques + chaîne), Rose Griffon TV. Outils de prod, hébergement.",
		icon: Sparkles,
		title: "Projets médiatiques",
	},
	{
		desc: "Achilléa : scène compétitive structurée, tournois nationaux, coaching.",
		icon: Trophy,
		title: "Développement e-sport",
	},
	{
		desc: "Serveurs, CDN, sites, bots Discord. Tout est self-hosted pour rester maître du data.",
		icon: Eye,
		title: "Infrastructure technique",
	},
];

function CtaButton({ option }: { option: (typeof SUPPORT_OPTIONS)[number] }) {
	const baseClass =
		"inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]";
	const variants = {
		primary: "bg-[#FF424D] text-white hover:bg-[#e63b46] shadow-lg",
		secondary: "bg-[#0070BA] text-white hover:bg-[#005ea6]",
	} as const;
	const className = `${baseClass} ${variants[option.variant]}`;

	return (
		<a
			href={option.href}
			target="_blank"
			rel="noopener noreferrer"
			className={className}
		>
			{option.cta} <ExternalLink className="size-4" />
		</a>
	);
}

export default function NousSoutenirPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Hero */}
			<section className="relative overflow-hidden">
				<div
					className="absolute inset-0 opacity-20 dark:opacity-30"
					style={{
						background:
							"radial-gradient(circle at 25% 25%, rgba(201,169,88,0.4), transparent 55%), radial-gradient(circle at 75% 65%, rgba(229,74,74,0.25), transparent 50%)",
					}}
				/>
				<div className="relative mx-auto max-w-5xl px-6 py-24 text-center">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#c9a958]/40 bg-[#c9a958]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#a08540] dark:text-[#c9a958]">
						<Heart className="h-3.5 w-3.5" /> Communauté & soutien
					</div>
					<h1 className="text-4xl font-bold sm:text-5xl md:text-6xl">
						<span className="bg-linear-to-r from-[#a08540] via-[#c9a958] to-[#a08540] bg-clip-text text-transparent dark:from-[#c9a958] dark:via-[#dab86a] dark:to-[#c9a958]">
							Nous soutenir
						</span>
					</h1>
					<p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
						Rose Griffon est{" "}
						<strong className="text-foreground">
							une association à but non lucratif
						</strong>{" "}
						portée par une équipe de bénévoles. Vos soutiens financent les
						projets, pas les salaires.
					</p>
					<div className="mt-10 flex flex-wrap items-center justify-center gap-3">
						<a
							href="#tiers"
							className="rounded-full bg-[#c9a958] px-6 py-3 font-semibold text-[#0c1730] transition hover:bg-[#dab86a]"
						>
							Voir les paliers
						</a>
						<a
							href="#transparence"
							className="rounded-full border border-border px-6 py-3 font-medium text-foreground transition hover:bg-muted"
						>
							Où va l'argent ↓
						</a>
					</div>
				</div>
			</section>

			{/* Tiers Patreon — remontés en haut, chaque pack a son bouton dédié */}
			<section
				id="tiers"
				className="mx-auto max-w-6xl px-6 pb-8 pt-4 scroll-mt-16 sm:pt-8"
			>
				<div className="mb-10 text-center">
					<h2 className="text-3xl font-bold">Les paliers de mécénat</h2>
					<p className="mt-3 text-muted-foreground">
						3 paliers principaux sur Patreon — Roy, Gaëlle, Evans. Chaque palier
						a son propre bouton pour choisir directement.
					</p>
				</div>
				<PublicTiers />
				<p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
					Patreon prélève une commission de 8 à 12% + frais de paiement. Pour
					maximiser le soutien net à l'association, un don unique PayPal est
					plus efficace côté frais.
				</p>
			</section>

			{/* Why */}
			<section className="mx-auto max-w-5xl px-6 py-16">
				<div className="grid gap-6 md:grid-cols-3">
					{WHY_CARDS.map((card, i) => (
						<div
							key={i}
							className="rounded-2xl border border-border bg-card p-6 text-card-foreground"
						>
							<card.icon className="size-6 text-[#c9a958]" />
							<h3 className="mt-4 font-bold">{card.title}</h3>
							<p className="mt-2 text-sm text-muted-foreground">{card.desc}</p>
						</div>
					))}
				</div>
			</section>

			{/* 2 options (Patreon récurrent vs PayPal one-shot) */}
			<section id="options" className="mx-auto max-w-5xl px-6 py-16">
				<div className="mb-10 text-center">
					<h2 className="text-3xl font-bold">Autres façons de nous soutenir</h2>
					<p className="mt-3 text-muted-foreground">
						Préférez un soutien mensuel libre ou un don ponctuel.
					</p>
				</div>
				<div className="grid gap-6 md:grid-cols-2">
					{SUPPORT_OPTIONS.map((opt) => (
						<div
							key={opt.key}
							className="rounded-2xl border border-border bg-card p-6 text-card-foreground"
						>
							<h3 className="text-lg font-bold">{opt.title}</h3>
							<p className="mt-1 text-xs uppercase tracking-wider text-[#a08540] dark:text-[#c9a958]">
								{opt.subtitle}
							</p>
							<p className="mt-4 text-sm text-muted-foreground">{opt.desc}</p>
							<div className="mt-6">
								<CtaButton option={opt} />
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Transparence */}
			<section id="transparence" className="mx-auto max-w-5xl px-6 py-16">
				<div className="mb-10 text-center">
					<h2 className="text-3xl font-bold">Où va votre soutien ?</h2>
					<p className="mt-3 text-muted-foreground">
						Bilan financier annuel partagé en assemblée générale. Pour toute
						question, contactez-nous.
					</p>
				</div>
				<div className="grid gap-6 md:grid-cols-2">
					{TRANSPARENCY.map((card, i) => (
						<div
							key={i}
							className="rounded-2xl border border-border bg-card p-6 text-card-foreground"
						>
							<card.icon className="size-6 text-[#c9a958]" />
							<h3 className="mt-4 font-bold">{card.title}</h3>
							<p className="mt-2 text-sm text-muted-foreground">{card.desc}</p>
						</div>
					))}
				</div>
			</section>

			{/* Footer CTA */}
			<section className="mx-auto max-w-3xl px-6 py-12 text-center">
				<div className="rounded-3xl border border-[#c9a958]/40 bg-card p-10">
					<Heart className="mx-auto size-8 text-[#c9a958]" />
					<h2 className="mt-3 text-2xl font-bold">Merci de faire vivre RG</h2>
					<p className="mt-3 text-muted-foreground">
						Chaque soutien — petit ou grand — fait avancer la communauté.
					</p>
					<div className="mt-6">
						<a
							href="#options"
							className="inline-flex items-center gap-2 rounded-full bg-[#c9a958] px-6 py-3 font-semibold text-[#0c1730] hover:bg-[#dab86a]"
						>
							Comment soutenir
							<ChevronRight className="size-4" />
						</a>
					</div>
				</div>
			</section>
		</div>
	);
}
