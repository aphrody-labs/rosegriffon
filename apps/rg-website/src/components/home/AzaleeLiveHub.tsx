"use client";

import { Button, Card } from "@rosegriffon/ui";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
	ArrowRight,
	BookOpen,
	Compass,
	FileText,
	Layers,
	Newspaper,
	Shield,
	Sparkles,
	Swords,
	Users,
	Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import { ItemCard } from "@/components/wiki/ItemCard";
import { MoveCard } from "@/components/wiki/MoveCard";
import { TeamCard } from "@/components/wiki/TeamCard";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { Twitter } from "@/lib/icons-config";
import { getCharacterImageUrl } from "@rosegriffon/azalee/images";
import type {
	AzaleePreviewData,
	PreviewCharacter,
	PreviewItem,
	PreviewSkill,
	PreviewTeam,
} from "@/app/api/public/azalee/preview/route";

export interface WikiSectionStats {
	characters: number;
	skills: number;
	items: number;
	keshins: number;
	souls: number;
	passives: number;
}

export interface ArticleItem {
	id: string;
	title: string;
	slug: string;
	excerpt: string;
	featured_image_url: string | null;
	featured_image_alt: string | null;
	published_at: string | null;
	created_at: string | null;
	category: string | null;
	author: {
		full_name: string | null;
		avatar_url: string | null;
	} | null;
}

export interface TweetItem {
	id: string;
	text: string;
	translation?: string | null;
	created_at: string;
	author_username: string;
	author_name: string;
	media: Array<{ url: string; preview_url?: string; video_url?: string; type?: string }>;
}

export interface AzaleeLiveHubProps {
	stats?: WikiSectionStats;
	articles?: ArticleItem[];
	tweets?: TweetItem[];
	previewData?: AzaleePreviewData;
	twitterLink?: string;
	instagramLink?: string;
}

const POSITION_SHORT: Record<string, string> = {
	Attaquant: "ATT",
	Défenseur: "DEF",
	Gardien: "GAR",
	Milieu: "MIL",
};

const POSITION_COLORS: Record<string, string> = {
	Attaquant: "bg-poste-attaquant/20 text-poste-attaquant border-poste-attaquant/30",
	Défenseur: "bg-poste-defenseur/20 text-poste-defenseur border-poste-defenseur/30",
	Gardien: "bg-poste-gardien/20 text-poste-gardien border-poste-gardien/30",
	Milieu: "bg-poste-milieu/20 text-poste-milieu border-poste-milieu/30",
};

const ELEMENT_SPRITE_MAP: Record<string, SpriteCommonKey> = {
	Feu: "fire",
	Fire: "fire",
	Forest: "forest",
	Forêt: "forest",
	Montagne: "mountain",
	Mountain: "mountain",
	Vent: "wind",
	Wind: "wind",
};

function CharacterMiniCard({ character }: { character: PreviewCharacter }) {
	const faceUrl = getCharacterImageUrl(character.internal_code || character.id);
	const posColor =
		POSITION_COLORS[character.position] ||
		"bg-surface-container-highest text-foreground border-outline-variant/30";
	const elSprite = ELEMENT_SPRITE_MAP[character.element];

	const charHref = `/wiki/chara/${character.base_slug || character.slug || character.id}`;

	return (
		<Link
			href={charHref}
			className="group/char p-3 rounded-2xl bg-surface-container-low/60 hover:bg-surface-container border border-outline-variant/20 hover:border-azalee-yellow/60 transition-all duration-200 flex flex-col justify-between relative overflow-hidden h-full"
		>
			<div className="flex items-center gap-3">
				<div className="relative size-12 sm:size-14 shrink-0 rounded-xl overflow-hidden bg-surface-container-highest border border-outline-variant/30 group-hover/char:scale-105 transition-transform">
					<Image
						src={faceUrl}
						alt={character.name_fr || character.name_en}
						fill
						unoptimized
						className="object-cover"
					/>
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-1.5 mb-1">
						<span
							className={`text-xs font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${posColor}`}
						>
							{POSITION_SHORT[character.position] || character.position}
						</span>
						{elSprite && (
							<span className="size-4 shrink-0">
								<CommonSpriteIcon name={elSprite} scale={0.32} />
							</span>
						)}
					</div>
					<h4 className="text-sm font-bold text-foreground truncate group-hover/char:text-azalee-yellow transition-colors">
						{character.name_fr || character.name_en}
					</h4>
					{character.name_ja && (
						<p className="text-xs text-muted-foreground truncate font-light">
							{character.name_ja}
						</p>
					)}
				</div>
			</div>
			<div className="pt-2 mt-2 border-t border-outline-variant/15 flex items-center justify-between text-xs">
				<span className="text-xs text-muted-foreground">Fiche Zukan</span>
				<span className="text-xs font-semibold text-azalee-yellow group-hover/char:translate-x-0.5 transition-transform flex items-center">
					Consulter →
				</span>
			</div>
		</Link>
	);
}

type TabFilter = "all" | "articles" | "tweets";

const CATEGORY_LABELS: Record<string, string> = {
	announcement: "Annonce",
	community: "Communauté",
	critique: "Critique",
	event: "Événement",
};

export function AzaleeLiveHub({
	stats,
	articles = [],
	tweets = [],
	previewData,
	twitterLink = "https://x.com/Azalee_IE",
}: AzaleeLiveHubProps) {
	const [activeTab, setActiveTab] = useState<TabFilter>("all");
	type PreviewTab = "characters" | "skills" | "items" | "teams";
	const [activePreview, setActivePreview] = useState<PreviewTab>("characters");
	const [liveData, setLiveData] = useState<AzaleePreviewData | undefined>(previewData);

	// Synchroniser les previews initiales et charger depuis l'API directe si absent
	useEffect(() => {
		if (previewData) {
			setLiveData(previewData);
			return;
		}
		let isMounted = true;
		fetch("/api/public/azalee/preview")
			.then((res) => res.json())
			.then((data) => {
				if (isMounted && data && !data.error) {
					setLiveData(data);
				}
			})
			.catch(() => {});
		return () => {
			isMounted = false;
		};
	}, [previewData]);

	// Fusion et tri chronologique unifié des articles et tweets
	const unifiedFeed = useMemo(() => {
		const items: Array<
			| { type: "article"; date: number; data: ArticleItem }
			| { type: "tweet"; date: number; data: TweetItem }
		> = [];

		articles.forEach((art) => {
			const dateStr = art.published_at || art.created_at;
			items.push({
				data: art,
				date: dateStr ? new Date(dateStr).getTime() : 0,
				type: "article",
			});
		});

		tweets.forEach((tw) => {
			items.push({
				data: tw,
				date: tw.created_at ? new Date(tw.created_at).getTime() : 0,
				type: "tweet",
			});
		});

		return items.sort((a, b) => b.date - a.date);
	}, [articles, tweets]);

	const filteredFeed = useMemo(() => {
		if (activeTab === "articles") {
			return unifiedFeed.filter((item) => item.type === "article");
		}
		if (activeTab === "tweets") {
			return unifiedFeed.filter((item) => item.type === "tweet");
		}
		return unifiedFeed;
	}, [unifiedFeed, activeTab]);

	const heroFeedItem = filteredFeed[0];
	const secondaryFeedItems = filteredFeed.slice(1, 4);

	// Catégories rapides du catalogue Wiki
	const wikiCategories = [
		{
			badge: "Base",
			count: stats?.characters,
			href: "/wiki/chara",
			icon: Users,
			name: "Joueurs",
		},
		{
			badge: "Mooves",
			count: stats?.skills,
			href: "/wiki/skill",
			icon: Swords,
			name: "Techniques",
		},
		{
			badge: "Items",
			count: stats?.items,
			href: "/wiki/item",
			icon: Shield,
			name: "Objets",
		},
		{
			badge: "Auras",
			count: (stats?.keshins ?? 0) + (stats?.souls ?? 0) || undefined,
			href: "/wiki/aura",
			icon: Sparkles,
			name: "Keshins & Âmes",
		},
		{
			badge: "Talents",
			count: stats?.passives,
			href: "/wiki/passive",
			icon: Zap,
			name: "Passifs",
		},
		{
			badge: "Outils",
			count: undefined,
			href: "/wiki/avatar",
			icon: Compass,
			name: "Atelier Avatar",
		},
	];

	return (
		<section
			aria-labelledby="azalee-hub-title"
			className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8"
		>
			<Card className="overflow-hidden border border-azalee-gold/40 azalee-glow-card azalee-card-gradient relative rounded-3xl p-3.5 sm:p-6 lg:p-8 flex flex-col gap-6">
				{/* Background lighting & textures */}
				<div
					className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none"
					style={{ backgroundImage: "url(/images/noise.svg)" }}
				/>
				<div className="absolute -right-24 -top-24 size-96 bg-azalee-pink rounded-full blur-[140px] opacity-25 pointer-events-none" />
				<div className="absolute -left-24 -bottom-24 size-96 bg-azalee-yellow rounded-full blur-[140px] opacity-15 pointer-events-none" />

				{/* ── 1. HEADER DU HUB : Titre, Stats rapides & Actions directes ── */}
				<div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-azalee-gold/20 pb-5">
					{/* Logo & Identité */}
					<div className="flex items-center gap-3 sm:gap-3.5">
						<div className="relative size-11 sm:size-14 shrink-0 rounded-2xl bg-surface-container-highest/40 border border-azalee-yellow/30 p-1 flex items-center justify-center shadow-lg">
							<Image
								src="/RG_Azalee-logo.webp"
								alt="Logo Azalée"
								width={48}
								height={48}
								className="object-contain drop-shadow"
								unoptimized
							/>
						</div>
						<div className="flex flex-col gap-0.5 min-w-0">
							<div className="flex items-center gap-2">
								<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-azalee-yellow/15 border border-azalee-yellow/30 text-azalee-yellow text-xs font-bold uppercase tracking-wider">
									<span className="size-1.5 rounded-full bg-azalee-yellow animate-pulse" />
									Wiki &amp; Actualités Victory Road
								</span>
							</div>
							<h2
								id="azalee-hub-title"
								className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-foreground leading-tight tracking-tight sm:tracking-wide font-expressive-title"
							>
								<span className="bg-clip-text text-transparent azalee-text-gradient">
									AZALÉE — WIKI VICTORY ROAD
								</span>
							</h2>
						</div>
					</div>

					{/* Barre de stats compactes & Boutons d'accès direct */}
					<div className="flex flex-wrap items-center gap-2 sm:gap-3">
						<div className="hidden xl:flex items-center gap-2 bg-surface-container-low/60 border border-outline-variant/20 rounded-2xl px-3 py-1.5 text-xs text-muted-foreground">
							{stats?.characters != null && (
								<>
									<span className="font-bold text-azalee-yellow tabular-nums">
										{stats.characters.toLocaleString("fr-FR")}
									</span>
									<span>Joueurs jouables</span>
									<span className="opacity-30">·</span>
								</>
							)}
							{stats?.skills != null && (
								<>
									<span className="font-bold text-azalee-yellow tabular-nums">
										{stats.skills.toLocaleString("fr-FR")}
									</span>
									<span>Techniques</span>
								</>
							)}
						</div>

						<Button
							asChild
							size="sm"
							className="bg-surface-container-lowest hover:bg-surface-container text-azalee-dark font-black rounded-xl shadow-md transition-all px-3.5 sm:px-4 py-2 min-h-[40px] text-xs sm:text-sm"
						>
							<Link href="/wiki">
								<BookOpen className="mr-1.5 size-3.5 text-azalee-pink" />
								Explorer le Wiki
							</Link>
						</Button>

						<Button
							asChild
							variant="outline"
							size="sm"
							className="border-azalee-pink/60 text-azalee-yellow hover:bg-azalee-pink/20 rounded-xl bg-surface-container-low/40 transition-all px-3 sm:px-3.5 py-2 min-h-[40px] text-xs sm:text-sm"
						>
							<Link href="/news">
								<Newspaper className="mr-1.5 size-3.5" />
								Toutes les actualités
							</Link>
						</Button>
					</div>
				</div>

				{/* ── 2. BENTO GRID UNIFIÉ : 2 COLONNES MAJEURES (WIKI vs LIVE NEWS) ── */}
				<div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
					{/* ── COLONNE GAUCHE (7 cols) : CATALOGUE WIKI & LIVE PREVIEWS ── */}
					<div className="lg:col-span-7 flex flex-col justify-between gap-4">
						{/* 2.1 Live Previews du Catalogue (Miniatures des vrais composants des vraies pages) */}
						<div className="flex flex-col gap-3">
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
								<div className="flex items-center gap-1.5">
									<Sparkles className="size-3.5 text-azalee-yellow" />
									<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
										Aperçus en direct du Wiki
									</span>
								</div>

								{/* Onglets sélecteurs de preview avec scroll horizontal fluide sur petit mobile */}
								<div className="flex items-center gap-1 overflow-x-auto max-w-full p-0.5 rounded-xl border border-outline-variant/20 bg-surface-container-high/40 text-xs">
									<button
										type="button"
										onClick={() => setActivePreview("characters")}
										className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] shrink-0 rounded-lg font-bold text-xs transition-all ${
											activePreview === "characters"
												? "bg-azalee-yellow text-azalee-dark shadow-sm"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										<Users className="size-3" />
										Joueurs
									</button>
									<button
										type="button"
										onClick={() => setActivePreview("skills")}
										className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] shrink-0 rounded-lg font-bold text-xs transition-all ${
											activePreview === "skills"
												? "bg-azalee-yellow text-azalee-dark shadow-sm"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										<Swords className="size-3" />
										Techniques
									</button>
									<button
										type="button"
										onClick={() => setActivePreview("items")}
										className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] shrink-0 rounded-lg font-bold text-xs transition-all ${
											activePreview === "items"
												? "bg-azalee-yellow text-azalee-dark shadow-sm"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										<Shield className="size-3" />
										Objets
									</button>
									<button
										type="button"
										onClick={() => setActivePreview("teams")}
										className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] shrink-0 rounded-lg font-bold text-xs transition-all ${
											activePreview === "teams"
												? "bg-azalee-yellow text-azalee-dark shadow-sm"
												: "text-muted-foreground hover:text-foreground"
										}`}
									>
										<Layers className="size-3" />
										Équipes
									</button>
								</div>
							</div>

							{/* Contenu dynamique de la preview */}
							{activePreview === "characters" && (
								<div className="flex flex-col gap-2.5">
									<div className="flex items-center justify-between text-xs px-0.5">
										<span className="text-muted-foreground">
											{stats?.characters
												? `${stats.characters.toLocaleString("fr-FR")} joueurs jouables uniques`
												: "Profils et fiches Zukan"}
										</span>
										<Link
											href="/wiki/chara"
											className="font-bold text-azalee-yellow hover:underline flex items-center gap-1"
										>
											Voir tous les joueurs
											<ArrowRight className="size-3" />
										</Link>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
										{liveData?.characters && liveData.characters.length > 0 ? (
											liveData.characters.map((char) => (
												<CharacterMiniCard key={char.id} character={char} />
											))
										) : (
											<div className="col-span-2 p-6 text-center text-xs text-muted-foreground rounded-2xl bg-surface-container-low/30 border border-outline-variant/15">
												Chargement des fiches de jeu...
											</div>
										)}
									</div>
								</div>
							)}

							{activePreview === "skills" && (
								<div className="flex flex-col gap-2.5">
									<div className="flex items-center justify-between text-xs px-0.5">
										<span className="text-muted-foreground">
											{stats?.skills
												? `${stats.skills.toLocaleString("fr-FR")} techniques répertoriées`
												: "Catalogue des mouvements"}
										</span>
										<Link
											href="/wiki/skill"
											className="font-bold text-azalee-yellow hover:underline flex items-center gap-1"
										>
											Voir toutes les techniques
											<ArrowRight className="size-3" />
										</Link>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
										{liveData?.skills && liveData.skills.length > 0 ? (
											liveData.skills.map((s) => (
												<MoveCard
													key={s.id}
													id={s.id}
													name={s.name_fr || s.name_en}
													category={s.category}
													element={s.element}
													powerMax={s.power_max ?? undefined}
													tensionCost={s.tension_cost ?? undefined}
												/>
											))
										) : (
											<div className="col-span-2 p-6 text-center text-xs text-muted-foreground rounded-2xl bg-surface-container-low/30 border border-outline-variant/15">
												Chargement des techniques...
											</div>
										)}
									</div>
								</div>
							)}

							{activePreview === "items" && (
								<div className="flex flex-col gap-2.5">
									<div className="flex items-center justify-between text-xs px-0.5">
										<span className="text-muted-foreground">
											{stats?.items
												? `${stats.items.toLocaleString("fr-FR")} objets et équipements`
												: "Inventaire et équipements"}
										</span>
										<Link
											href="/wiki/item"
											className="font-bold text-azalee-yellow hover:underline flex items-center gap-1"
										>
											Voir tous les objets
											<ArrowRight className="size-3" />
										</Link>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
										{liveData?.items && liveData.items.length > 0 ? (
											liveData.items.map((item) => (
												<ItemCard
													key={item.id}
													id={item.id}
													name={item.name_fr || item.name_en}
													category={item.category}
													internalCode={item.internal_code}
													rarity={item.rarity ?? undefined}
												/>
											))
										) : (
											<div className="col-span-2 p-6 text-center text-xs text-muted-foreground rounded-2xl bg-surface-container-low/30 border border-outline-variant/15">
												Chargement des objets...
											</div>
										)}
									</div>
								</div>
							)}

							{activePreview === "teams" && (
								<div className="flex flex-col gap-2.5">
									<div className="flex items-center justify-between text-xs px-0.5">
										<span className="text-muted-foreground">
											Clubs et formations du jeu
										</span>
										<Link
											href="/wiki/equipe"
											className="font-bold text-azalee-yellow hover:underline flex items-center gap-1"
										>
											Voir toutes les équipes
											<ArrowRight className="size-3" />
										</Link>
									</div>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
										{liveData?.teams && liveData.teams.length > 0 ? (
											liveData.teams.map((t) => (
												<TeamCard
													key={t.id}
													team={{
														id: t.id,
														name: t.name_fr || t.name_en,
														nameJa: t.name_ja,
														nameEn: t.name_en,
														emblemUrl: t.emblem_url,
														seasons: {},
														seriesKeys: [],
														rosterCount: 0,
														order: 0,
													}}
												/>
											))
										) : (
											<div className="col-span-2 p-6 text-center text-xs text-muted-foreground rounded-2xl bg-surface-container-low/30 border border-outline-variant/15">
												Chargement des équipes...
											</div>
										)}
									</div>
								</div>
							)}
						</div>

						{/* 2.2 Sélecteur de Catégories (Le Carrousel condensé en Pills d'accès rapide) */}
						<div className="flex flex-col gap-2 pt-1 border-t border-outline-variant/15">
							<span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
								<Layers className="size-3" />
								Sections du Jeu
							</span>
							<div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
								{wikiCategories.map((cat) => {
									const IconComp = cat.icon;
									return (
										<Link
											key={cat.href}
											href={cat.href}
											className="p-2.5 rounded-xl bg-surface-container-low/40 border border-outline-variant/15 hover:border-azalee-yellow/40 transition-all flex flex-col items-center justify-center text-center gap-1 group/pill hover:bg-surface-container-high/60"
										>
											<IconComp className="size-4 text-azalee-yellow group-hover/pill:scale-110 transition-transform" />
											<span className="text-xs font-bold text-foreground truncate w-full">
												{cat.name}
											</span>
											{cat.count ? (
												<span className="text-xs font-semibold text-muted-foreground tabular-nums">
													{cat.count.toLocaleString("fr-FR")}
												</span>
											) : (
												<span className="text-xs font-semibold text-muted-foreground">
													{cat.badge}
												</span>
											)}
										</Link>
									);
								})}
							</div>
						</div>
					</div>

					{/* ── COLONNE DROITE (5 cols) : FLUX LIVE ACTUALITÉS & TWEETS X ── */}
					<div className="lg:col-span-5 flex flex-col justify-between gap-3 bg-surface-container-lowest/20 border border-outline-variant/15 rounded-2xl p-4 sm:p-5">
						{/* En-tête du flux & Filtres d'onglets */}
						<div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
							<div className="flex items-center gap-2">
								<Newspaper className="size-4 text-azalee-yellow" />
								<h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
									Dernières Actus &amp; Notes
								</h3>
							</div>

							{/* Onglets interactifs */}
							<div className="flex items-center bg-surface-container-high/40 p-0.5 rounded-lg border border-outline-variant/20 text-xs">
								<button
									type="button"
									onClick={() => setActiveTab("all")}
									className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
										activeTab === "all"
											? "bg-azalee-pink text-primary-foreground"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Tout
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("articles")}
									className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
										activeTab === "articles"
											? "bg-azalee-pink text-primary-foreground"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Articles
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("tweets")}
									className={`px-2 py-0.5 rounded-md font-bold transition-colors ${
										activeTab === "tweets"
											? "bg-azalee-pink text-primary-foreground"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									X
								</button>
							</div>
						</div>

						{/* Hero Item (Publication majeure la plus récente) */}
						{heroFeedItem && (
							<div className="group/hero relative rounded-xl overflow-hidden border border-outline-variant/15 bg-surface-container/20">
								{heroFeedItem.type === "article" ? (
									<Link href={`/news/${heroFeedItem.data.slug}`} className="block relative">
										<div className="relative aspect-16/9 w-full overflow-hidden bg-surface-container-highest">
											<Image
												src={
													heroFeedItem.data.featured_image_url ||
													"/images/placeholder-news.svg"
												}
												alt={heroFeedItem.data.title}
												fill
												className="object-cover group-hover/hero:scale-105 transition-transform duration-500"
												sizes="(max-width: 768px) 100vw, 400px"
											/>
											<div className="absolute inset-0 bg-linear-to-t from-surface-container-highest via-surface-container-highest/40 to-transparent" />
											<div className="absolute top-2.5 left-2.5">
												<span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-azalee-pink text-primary-foreground">
													{CATEGORY_LABELS[heroFeedItem.data.category || ""] || "Actu"}
												</span>
											</div>
											<div className="absolute bottom-2.5 left-2.5 right-2.5">
												<h4 className="text-xs sm:text-sm font-bold text-foreground line-clamp-2 leading-snug group-hover/hero:text-azalee-yellow transition-colors">
													{heroFeedItem.data.title}
												</h4>
												<div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
													<span>{heroFeedItem.data.author?.full_name || "Rose Griffon"}</span>
													<span>·</span>
													<span>
														{heroFeedItem.data.published_at
															? formatDistanceToNow(new Date(heroFeedItem.data.published_at), {
																	addSuffix: true,
																	locale: fr,
																})
															: "Récemment"}
													</span>
												</div>
											</div>
										</div>
									</Link>
								) : (
									<Link
										href={`/news/tweet/${heroFeedItem.data.id}`}
										className="flex flex-col gap-2 p-3 hover:bg-surface-container/40 transition-colors"
									>
										<div className="flex items-center justify-between">
											<span className="inline-flex items-center gap-1 text-xs font-bold uppercase px-2 py-0.5 rounded bg-primary/20 text-primary">
												<Twitter className="size-2.5 fill-current" />
												Post X Traduit
											</span>
											<span className="text-xs text-muted-foreground">
												{formatDistanceToNow(new Date(heroFeedItem.data.created_at), {
													addSuffix: true,
													locale: fr,
												})}
											</span>
										</div>
										<p className="text-xs text-foreground line-clamp-3 leading-relaxed font-light">
											{heroFeedItem.data.translation || heroFeedItem.data.text}
										</p>
									</Link>
								)}
							</div>
						)}

						{/* Items secondaires compacts (Flux rapide) */}
						<div className="flex flex-col gap-2">
							{secondaryFeedItems.map((item) => {
								if (item.type === "article") {
									return (
										<Link
											key={item.data.id}
											href={`/news/${item.data.slug}`}
											className="flex items-center gap-3 p-2 rounded-xl bg-surface-container/20 hover:bg-surface-container/50 border border-outline-variant/10 transition-all group/item"
										>
											<div className="relative size-12 shrink-0 rounded-lg overflow-hidden bg-surface-container-highest">
												<Image
													src={
														item.data.featured_image_url ||
														"/images/placeholder-news.svg"
													}
													alt=""
													fill
													className="object-cover"
													sizes="48px"
												/>
											</div>
											<div className="flex-1 min-w-0">
												<h5 className="text-xs font-bold text-foreground truncate group-hover/item:text-azalee-yellow transition-colors">
													{item.data.title}
												</h5>
												<span className="text-xs text-muted-foreground">
													{item.data.published_at
														? formatDistanceToNow(new Date(item.data.published_at), {
																addSuffix: true,
																locale: fr,
															})
														: "Récemment"}
												</span>
											</div>
											<ArrowRight className="size-3 text-muted-foreground group-hover/item:text-azalee-yellow group-hover/item:translate-x-0.5 transition-all shrink-0" />
										</Link>
									);
								}

								return (
									<Link
										key={item.data.id}
										href={`/news/tweet/${item.data.id}`}
										className="flex items-center gap-3 p-2 rounded-xl bg-surface-container/20 hover:bg-surface-container/50 border border-outline-variant/10 transition-all group/item"
									>
										<div className="size-12 shrink-0 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
											<Twitter className="size-5 fill-current" />
										</div>
										<div className="flex-1 min-w-0">
											<h5 className="text-xs font-medium text-foreground truncate group-hover/item:text-azalee-yellow transition-colors">
												{item.data.translation || item.data.text}
											</h5>
											<span className="text-xs text-muted-foreground">
												{formatDistanceToNow(new Date(item.data.created_at), {
													addSuffix: true,
													locale: fr,
												})}
											</span>
										</div>
										<ArrowRight className="size-3 text-muted-foreground group-hover/item:text-azalee-yellow group-hover/item:translate-x-0.5 transition-all shrink-0" />
									</Link>
								);
							})}
						</div>

						{/* Pied de flux */}
						<div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between text-xs">
							<a
								href={twitterLink}
								target="_blank"
								rel="noopener noreferrer"
								className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
							>
								<Twitter className="size-3 fill-current" />
								@Azalee_IE
							</a>
							<Link
								href="/news"
								className="text-xs font-bold text-azalee-yellow hover:underline flex items-center gap-1"
							>
								Voir tout le fil
								<ArrowRight className="size-3" />
							</Link>
						</div>
					</div>
				</div>
			</Card>
		</section>
	);
}
