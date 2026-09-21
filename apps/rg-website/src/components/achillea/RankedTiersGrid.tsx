import Image from "next/image";
import Link from "next/link";
import { rankImagePath } from "@/lib/achillea";
import { ArrowRight, Crown, Sparkles } from "lucide-react";

export interface TierItem {
	key: string;
	minElo: number;
	maxElo: number;
	level: number;
	color: string;
	description: string;
}

export const CANONICAL_TIERS: TierItem[] = [
	{ key: "Fer", minElo: 0, maxElo: 149, level: 1, color: "#959595", description: "Débutants & premiers pas compétitifs" },
	{ key: "Bronze", minElo: 150, maxElo: 299, level: 2, color: "#b17253", description: "Apprentissage des mécaniques et du rythme" },
	{ key: "Argent", minElo: 300, maxElo: 449, level: 3, color: "#7facb8", description: "Maîtrise des bases et des duels individuels" },
	{ key: "Or", minElo: 450, maxElo: 599, level: 4, color: "#c2ad88", description: "Tactique d'équipe et circulation de balle" },
	{ key: "Platine", minElo: 600, maxElo: 749, level: 5, color: "#897e8b", description: "Niveau intermédiaire solide et vision du jeu" },
	{ key: "Diamant", minElo: 750, maxElo: 899, level: 6, color: "#88f6ff", description: "Joueurs confirmés et tacticiens aguerris" },
	{ key: "Émeraude", minElo: 900, maxElo: 1049, level: 7, color: "#2d925c", description: "Haut niveau compétitif et constance" },
	{ key: "Rubis", minElo: 1050, maxElo: 1199, level: 8, color: "#ff5648", description: "Élite régionale et compétiteurs de tournois" },
	{ key: "Divin", minElo: 1200, maxElo: 1349, level: 9, color: "#7edcb5", description: "Maîtres de la méta et leaders d'équipes" },
	{ key: "Supernova", minElo: 1350, maxElo: 1499, level: 10, color: "#f010ff", description: "L'antichambre des champions suprêmes" },
	{ key: "Légendaire", minElo: 1500, maxElo: 9999, level: 11, color: "#ffa910", description: "Le sommet absolu de la scène Inazuma Eleven" },
];

export function RankedTiersGrid({ className = "" }: { className?: string }) {
	return (
		<section
			aria-labelledby="ranked-tiers-title"
			className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 ${className}`}
		>
			<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline/15 pb-4">
				<div className="space-y-1">
					<div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-achillea-purple/25 border border-achillea-lime/40 text-achillea-lime text-xs font-bold uppercase tracking-wider">
						<Crown className="size-3.5" />
						Progression &amp; Classement
					</div>
					<h2
						id="ranked-tiers-title"
						className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight"
					>
						L&apos;Échelle des 11 Paliers ELO
					</h2>
					<p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
						Franchissez les seuils de points d&apos;action (AP) en match classé 1v1 et 2v2 pour faire évoluer votre palier et débloquer les insignes officiels.
					</p>
				</div>

				<Link
					href="/achillea/ranked/tiers"
					className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-achillea-lime hover:underline shrink-0 group"
				>
					Répartition complète des joueurs
					<ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
				</Link>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2.5 sm:gap-3">
				{CANONICAL_TIERS.map((tier) => {
					const badgeUrl = rankImagePath(tier.key, "/achillea/ranks");
					const pointsLabel =
						tier.maxElo >= 9000
							? `${tier.minElo}+ AP`
							: `${tier.minElo} - ${tier.maxElo} AP`;

					return (
						<Link
							key={tier.key}
							href="/achillea/ranked/tiers"
							className="group relative flex flex-col items-center p-3 rounded-2xl bg-surface/80 border border-outline/20 hover:border-achillea-lime/60 hover:bg-surface hover:shadow-xl transition-all duration-300 text-center overflow-hidden"
						>
							{/* Subtle top indicator with tier gradient */}
							<div
								className="absolute top-0 inset-x-0 h-1"
								style={{ backgroundColor: tier.color }}
							/>

							{/* Rank Badge Image */}
							<div className="relative size-14 sm:size-16 my-2 group-hover:scale-110 transition-transform duration-300 drop-shadow-md">
								<Image
									src={badgeUrl}
									alt={`Badge Palier ${tier.key}`}
									fill
									unoptimized
									className="object-contain"
								/>
							</div>

							{/* Tier Name */}
							<h3 className="text-xs sm:text-sm font-black text-on-surface group-hover:text-achillea-lime transition-colors">
								{tier.key}
							</h3>

							{/* Points range */}
							<span className="text-[11px] font-bold text-on-surface-variant font-mono tabular-nums mt-0.5">
								{pointsLabel}
							</span>

							{/* Micro level indicator */}
							<span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mt-1">
								Rang #{tier.level}
							</span>
						</Link>
					);
				})}
			</div>
		</section>
	);
}
