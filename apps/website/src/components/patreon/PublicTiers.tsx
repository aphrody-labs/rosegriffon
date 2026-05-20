import { Check, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

interface Tier {
	key: "roy" | "gaelle" | "evans" | "communaute" | "route-victoire";
	name: string;
	priceCents: number | null;
	color: string;
	tagline: string;
	perks: string[];
	href: string;
	cta: string;
	highlight?: boolean;
	patrons?: number;
}

const PATREON_URL = "https://patreon.com/RoseGriffon";

const FEATURED_TIERS: Tier[] = [
	{
		color: "#aac9d9",
		cta: "Choisir Roy",
		href: PATREON_URL,
		key: "roy",
		name: "𝙽𝚒𝚟𝚎𝚊𝚞 𝚁𝚘𝚢 🌹",
		perks: [
			"Rôle Discord dédié Roy",
			"Mention au générique des chroniques",
			"Accès aux annonces avant tout le monde",
		],
		priceCents: 250,
		tagline: "Premier pas de soutien",
	},
	{
		color: "#e54a4a",
		cta: "Choisir Gaëlle",
		href: PATREON_URL,
		key: "gaelle",
		name: "𝙽𝚒𝚟𝚎𝚊𝚞 𝙶𝚊𝚎𝚕𝚕𝚎 🌹",
		perks: [
			"Tous les avantages Roy",
			"Accès aux articles en avant-première",
			"Vote sur les futurs sujets traités",
		],
		priceCents: 750,
		tagline: "Soutien renforcé",
	},
	{
		color: "#5fa893",
		cta: "Choisir Evans",
		highlight: true,
		href: PATREON_URL,
		key: "evans",
		name: "𝙽𝚒𝚟𝚎𝚊𝚞 𝙴𝚟𝚊𝚗𝚜 🌹",
		patrons: 8,
		perks: [
			"Tous les avantages Gaëlle",
			"Pack Personnage trimestriel offert (print A5 + marque-page + sticker + grand badge)",
			"Salon Discord privé avec l'équipe",
			"Cartes de licence Roy & Gaëlle exclusives (25 premiers)",
		],
		priceCents: 1450,
		tagline: "Tier-phare · Soutien complet",
	},
];

const SIDE_TIERS: Tier[] = [
	{
		color: "#5fa893",
		cta: "Rejoindre Discord",
		href: "https://discord.gg/8X8eQfBMkt",
		key: "communaute",
		name: "Communauté",
		perks: [
			"Accès au serveur Discord Rose Griffon",
			"Newsletter occasionnelle",
			"Suivi des chroniques et événements",
		],
		priceCents: 0,
		tagline: "Gratuit · Rejoindre la communauté",
	},
	{
		color: "#c9a958",
		cta: "Devenir grand mécène",
		href: PATREON_URL,
		key: "route-victoire",
		name: "𝚁𝚘𝚞𝚝𝚎 𝚅𝚒𝚌𝚝𝚘𝚒𝚛𝚎 🥀",
		perks: [
			"Avantages identiques à Niveau Evans",
			"Mention spéciale comme grand mécène",
			"Réservé à celles et ceux qui veulent aller plus loin",
		],
		priceCents: 4900,
		tagline: "Pour soutenir massivement",
	},
];

function formatPrice(cents: number | null): string {
	if (cents === null) {return "—";}
	if (cents === 0) {return "Gratuit";}
	return `${(cents / 100).toFixed(2).replace(".", ",")} €/mois`;
}

function TierCard({ tier }: { tier: Tier }) {
	return (
		<div
			className={cn(
				"relative flex flex-col rounded-2xl border p-6 transition",
				tier.highlight
					? "border-[#c9a958] bg-card shadow-[0_0_24px_rgba(201,169,88,0.2)] lg:scale-[1.02]"
					: "border-border bg-card",
			)}
		>
			{tier.highlight && (
				<div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#c9a958] px-3 py-1 text-xs font-bold text-[#0c1730]">
					TIER PHARE
				</div>
			)}
			<div
				className="mb-3 inline-block w-fit rounded-md border px-2 py-1 text-xs font-semibold text-foreground"
				style={{
					backgroundColor: `${tier.color}33`,
					borderColor: `${tier.color}80`,
				}}
			>
				{tier.tagline}
			</div>
			<h3 className="text-lg font-bold text-foreground">{tier.name}</h3>
			<p className="mb-4 mt-1 text-2xl font-bold text-[#a08540] dark:text-[#c9a958]">
				{formatPrice(tier.priceCents)}
			</p>
			<ul className="space-y-2 text-sm text-foreground/85">
				{tier.perks.map((perk, i) => (
					<li key={i} className="flex gap-2">
						<Check
							className="mt-0.5 size-4 shrink-0"
							style={{ color: tier.color }}
						/>
						<span>{perk}</span>
					</li>
				))}
			</ul>
			{tier.patrons !== undefined && tier.patrons > 0 && (
				<p className="mt-4 text-xs text-muted-foreground">
					{tier.patrons} mécène{tier.patrons > 1 ? "s" : ""} actuellement
				</p>
			)}
			<div className="mt-6 pt-2">
				<a
					href={tier.href}
					target="_blank"
					rel="noopener noreferrer"
					className={cn(
						"inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.02] active:scale-[0.98]",
						tier.priceCents === 0
							? "border border-border bg-muted text-foreground hover:bg-muted/70"
							: (tier.highlight
								? "bg-[#c9a958] text-[#0c1730] shadow-md hover:bg-[#dab86a]"
								: "bg-[#FF424D] text-white hover:bg-[#e63b46]"),
					)}
				>
					{tier.cta}
					<ExternalLink className="size-4" aria-hidden="true" />
				</a>
			</div>
		</div>
	);
}

export function PublicTiers() {
	return (
		<div className="space-y-10">
			<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{FEATURED_TIERS.map((tier) => (
					<TierCard key={tier.key} tier={tier} />
				))}
			</div>

			<div className="space-y-4">
				<p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
					Autres options
				</p>
				<div className="grid gap-6 md:grid-cols-2">
					{SIDE_TIERS.map((tier) => (
						<TierCard key={tier.key} tier={tier} />
					))}
				</div>
			</div>
		</div>
	);
}
