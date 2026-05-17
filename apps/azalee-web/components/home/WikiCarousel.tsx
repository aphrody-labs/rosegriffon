import Link from "next/link";
import { AnimatedCounter } from "./AnimatedCounter";

export interface WikiSectionStats {
	characters: number;
	skills: number;
	items: number;
	keshins: number;
	souls: number;
	passives: number;
}

const WIKI_SECTIONS: Array<{
	title: string;
	description: string;
	href: string;
	sprite?: string;
	icon?: string;
	gradientColors: string;
	statKey?: keyof WikiSectionStats;
}> = [
	{
		title: "Joueurs",
		description: "Stats, techniques et recrutement",
		href: "/chara",
		sprite: "chara",
		gradientColors: "bg-gradient-to-r from-blue-600 to-cyan-500",
		statKey: "characters",
	},
	{
		title: "Techniques",
		description: "Tirs, dribbles et blocages",
		href: "/skill",
		sprite: "skill",
		gradientColors: "bg-gradient-to-r from-red-600 to-orange-500",
		statKey: "skills",
	},
	{
		title: "Auras",
		description: "Keshins, totems, miximax et plus",
		href: "/aura",
		sprite: "keshin",
		gradientColors: "bg-gradient-to-r from-violet-600 to-purple-500",
		statKey: "keshins",
	},
	{
		title: "Objets",
		description: "Équipements et consommables",
		href: "/item",
		icon: "backpack",
		gradientColors: "bg-gradient-to-r from-emerald-600 to-green-500",
		statKey: "items",
	},
	{
		title: "Passifs",
		description: "Effets des talents innés",
		href: "/passive",
		sprite: "tension",
		gradientColors: "bg-gradient-to-r from-pink-600 to-rose-500",
		statKey: "passives",
	},
	{
		title: "Comparateur",
		description: "Comparez deux joueurs côte à côte",
		href: "/tools/compare",
		icon: "compare_arrows",
		gradientColors: "bg-gradient-to-r from-indigo-600 to-blue-500",
	},
	{
		title: "Mon Équipe",
		description: "Composez votre équipe idéale",
		href: "/tools/my-team",
		icon: "stadium",
		gradientColors: "bg-gradient-to-r from-teal-600 to-cyan-500",
	},
	{
		title: "Actualités",
		description: "News et mises à jour",
		href: "/news",
		icon: "newspaper",
		gradientColors: "bg-gradient-to-r from-slate-600 to-gray-500",
	},
];

interface WikiCarouselProps {
	stats?: WikiSectionStats;
}

export function WikiCarousel({ stats }: WikiCarouselProps) {
	return (
		<section className="w-full">
			<div className="mb-5 md:mb-6 px-4 md:px-8 lg:px-12">
				<h2 className="text-xl md:text-3xl font-black text-on-surface font-expressive-title flex items-center gap-3">
					<span className="w-2 h-8 rounded-full bg-secondary" />
					Encyclopédie
				</h2>
			</div>

			{/* Single responsive render: horizontal scroll on mobile, grid on desktop */}
			<div className="flex overflow-x-auto snap-x snap-proximity gap-3 -mx-4 px-4 pb-1 scrollbar-hide md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 lg:gap-6 md:mx-0 md:px-8 lg:px-12 md:overflow-visible md:snap-none md:pb-0">
				{WIKI_SECTIONS.map((section) => {
					const count =
						section.statKey && stats ? stats[section.statKey] : undefined;

					return (
						<Link
							key={section.href}
							href={section.href}
							className="flex-shrink-0 min-w-[110px] snap-start md:min-w-0 md:snap-align-none group flex flex-col rounded-2xl bg-surface-container overflow-hidden transition-colors active:bg-surface-container-high md:transition-all md:duration-200 md:hover:bg-surface-container-high md:hover:shadow-md md:hover:-translate-y-1"
						>
							<div className={`h-[3px] w-full ${section.gradientColors}`} />
							<div className="p-3 md:p-5 flex flex-col gap-1 md:gap-1.5">
								<h3 className="text-xs md:text-sm lg:text-base font-bold text-on-surface leading-tight md:group-hover:text-primary md:transition-colors">
									{section.title}
								</h3>
								{count != null && count > 0 && (
									<AnimatedCounter
										value={count}
										className="text-lg md:text-[28px] md:leading-9 font-black text-primary tabular-nums"
									/>
								)}
								<p className="text-[10px] md:text-xs text-on-surface-variant/70 md:text-on-surface-variant leading-snug line-clamp-1 md:line-clamp-none md:opacity-70 md:group-hover:opacity-100 md:transition-opacity">
									{section.description}
								</p>
							</div>
						</Link>
					);
				})}
			</div>
		</section>
	);
}
