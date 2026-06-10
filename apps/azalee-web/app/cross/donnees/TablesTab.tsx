import React from "react";
import Link from "next/link";
import { ArrowRight, Users, Swords, Backpack, BookOpen, Trophy, ShoppingBag, Settings } from "lucide-react";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { TABLE_METADATA, humanizeClassName } from "@/lib/cross/data-shared";
import classTaxonomyJson from "@/data/cross/class-taxonomy.json";

interface TableCategory {
	name: string;
	icon: string;
	description: string;
	domains: string[];
}

const CATEGORIES: TableCategory[] = [
	{
		name: "Personnages & Éveil",
		icon: "users",
		description: "Profils des joueurs, relations d'affinité et mécanique d'éveil des raretés.",
		domains: ["Character", "Training", "Reward"],
	},
	{
		name: "Combats & Supertechniques",
		icon: "swords",
		description: "Supertechniques (Hissatsu), formations tactiques, équipes ennemies et physique du jeu.",
		domains: ["Battle", "SpecialMoves/Skills", "Formation_Team", "Sound"],
	},
	{
		name: "Inventaire & Équipements",
		icon: "backpack",
		description: "Objets de l'inventaire, équipements statistiques, cadeaux et matériaux de craft.",
		domains: ["Item", "Equipment", "Emblem_Customize"],
	},
	{
		name: "Mode Histoire & Quêtes",
		icon: "book-open",
		description: "Plateaux de scénario, quêtes narratives, tutoriels et dialogues d'événements.",
		domains: ["Story", "Mission", "Stage", "Tutorial"],
	},
	{
		name: "Multijoueur, Raids & Guildes",
		icon: "trophy",
		description: "Ligues PvP, combats de boss en Raid, clans/guildes et Passes de Combat.",
		domains: ["PvP", "Raid", "Guild", "BattlePass"],
	},
	{
		name: "Boutiques & Tirages (Gacha)",
		icon: "shopping-bag",
		description: "Boutique en jeu, packs spéciaux, tirages (Gacha), taux d'apparition et bonus de connexion.",
		domains: ["Gacha", "Shop_IAP", "Auth_Account"],
	},
	{
		name: "Système & Personnalisation",
		icon: "settings",
		description: "Calendriers globaux, messagerie Inalink, décoration du club-house et messagerie.",
		domains: ["Club", "Social", "Event"],
	},
];

const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
	"Personnages & Éveil": Users,
	"Combats & Supertechniques": Swords,
	"Inventaire & Équipements": Backpack,
	"Mode Histoire & Quêtes": BookOpen,
	"Multijoueur, Raids & Guildes": Trophy,
	"Boutiques & Tirages (Gacha)": ShoppingBag,
	"Système & Personnalisation": Settings,
};

function getTableCategory(fullName: string): string {
	const tax = classTaxonomyJson as any;
	const domains = (tax.domains || {}) as Record<string, string[]>;
	for (const cat of CATEGORIES) {
		for (const domain of cat.domains) {
			const classesInDomain = domains[domain] || [];
			if (classesInDomain.includes(fullName)) {
				return cat.name;
			}
		}
	}
	return "Système & Personnalisation";
}

interface TablesTabProps {
	tables: Array<{
		slug: string;
		short: string;
		fullName: string;
		columnCount: number;
	}>;
	dev: boolean;
	q: string;
}

export function TablesTab({ tables, dev, q }: TablesTabProps) {
	return (
		<section className="space-y-6">
			<h2 className="text-lg font-black text-on-surface mb-3">
				Exploration des données du jeu <span className="text-on-surface-variant font-normal">({tables.length} tables trouvées)</span>
			</h2>

			{q ? (
				<FadeInStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{tables.map((t) => {
						const meta = TABLE_METADATA[t.short] || { 
							label: humanizeClassName(t.short), 
							desc: `Fichier de données du système ${humanizeClassName(t.short).toLowerCase()}.` 
						};
						return (
							<FadeInItem key={t.slug}>
								<Link
									href={`/cross/donnees/${encodeURIComponent(t.slug)}${dev ? "?dev=true" : ""}`}
									className="group block rounded-2xl bg-surface-container hover:bg-surface-container-high transition-colors p-4 border border-outline-variant/50 h-full hover:shadow-sm"
								>
									<div className="flex items-start justify-between gap-2">
										<span className="font-bold text-on-surface text-sm leading-tight group-hover:text-[#00aeef] transition-colors">{meta.label}</span>
										<ArrowRight
											size={16}
											className="text-on-surface-variant group-hover:translate-x-0.5 transition-transform shrink-0"
										/>
									</div>
									<p className="text-xs text-on-surface-variant mt-1.5 line-clamp-2">
										{meta.desc}
									</p>
									<div className="mt-3 flex items-center justify-between border-t border-outline-variant/10 pt-2 text-[10px] font-mono text-on-surface-variant/70">
										<span className="truncate max-w-[150px]" title={t.short}>{t.short}</span>
										<span>{t.columnCount} colonnes</span>
									</div>
								</Link>
							</FadeInItem>
						);
					})}
				</FadeInStagger>
			) : (
				<div className="space-y-6">
					{CATEGORIES.map((cat) => {
						const catTables = tables.filter((t) => getTableCategory(t.fullName) === cat.name);
						if (catTables.length === 0) return null;
						const IconComponent = CATEGORY_ICONS[cat.name] || Settings;

						return (
							<div key={cat.name} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5 space-y-4">
								<div className="flex items-center gap-3">
									<div className="p-2 rounded-xl bg-primary-container text-on-primary-container">
										<IconComponent size={20} />
									</div>
									<div>
										<h3 className="text-lg font-black text-on-surface flex items-center gap-2">
											{cat.name}
											<span className="text-xs font-normal text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
												{catTables.length} tables
											</span>
										</h3>
										<p className="text-xs text-on-surface-variant">{cat.description}</p>
									</div>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
									{catTables.map((t) => {
										const meta = TABLE_METADATA[t.short] || { 
											label: humanizeClassName(t.short), 
											desc: `Fichier de données du système ${humanizeClassName(t.short).toLowerCase()}.` 
										};
										return (
											<Link
												key={t.slug}
												href={`/cross/donnees/${encodeURIComponent(t.slug)}${dev ? "?dev=true" : ""}`}
												className="group rounded-xl bg-surface-container-lowest hover:bg-surface-container-high transition-all p-4 border border-outline-variant/30 flex flex-col justify-between h-full hover:shadow-sm"
											>
												<div>
													<div className="flex items-start justify-between gap-2">
														<span className="font-bold text-on-surface text-sm leading-tight group-hover:text-[#00aeef] transition-colors">
															{meta.label}
														</span>
														<ArrowRight
															size={14}
															className="text-on-surface-variant group-hover:translate-x-0.5 transition-transform shrink-0 mt-0.5"
														/>
													</div>
													<p className="text-xs text-on-surface-variant mt-1.5 line-clamp-2 leading-relaxed">
														{meta.desc}
													</p>
												</div>
												<div className="mt-3 flex items-center justify-between border-t border-outline-variant/10 pt-2 text-[10px] font-mono text-on-surface-variant/70">
													{dev ? (
														<>
															<span className="truncate max-w-[120px]" title={t.short}>{t.short}</span>
															<span>{t.columnCount} col.</span>
														</>
													) : (
														<>
															<span className="text-[10px] text-on-surface-variant/60 font-sans">Système de jeu</span>
															<span>{t.columnCount} paramètres</span>
														</>
													)}
												</div>
											</Link>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
