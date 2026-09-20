import { Button, Card, CardContent } from "@rosegriffon/ui";
import {
	BookOpen,
	ExternalLink,
	Globe,
	Newspaper,
	Shield,
	Swords,
	Trophy,
	Users,
	Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { WikiSectionStats } from "./WikiCarousel";

interface PillarsDuoProps {
	wikiStats?: WikiSectionStats;
	azaleeTwitter?: string;
	achilleaDiscord?: string;
}

export function PillarsDuo({
	wikiStats,
	azaleeTwitter = "https://x.com/Azalee_IE",
	achilleaDiscord = "https://discord.gg/achillea-competitif-inazuma-eleven-fr-1055585286320554055",
}: PillarsDuoProps) {
	return (
		<section
			aria-labelledby="pillars-heading"
			className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 space-y-6"
		>
			<div className="text-center max-w-3xl mx-auto space-y-2">
				<div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase tracking-wider">
					Les Deux Grands Univers
				</div>
				<h2
					id="pillars-heading"
					className="text-2xl sm:text-3xl lg:text-4xl font-black text-on-surface font-expressive-title"
				>
					Encyclopédie ou Compétition : Choisissez votre terrain
				</h2>
				<p className="text-sm sm:text-base text-on-surface-variant">
					Rose Griffon unit les deux piliers fondamentaux de la communauté française Inazuma Eleven.
					Accédez directement à l'espace intégré ou retrouvez leurs sites dédiés originels.
				</p>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
				{/* ============================================================ */}
				{/* PILIER 1 : AZALÉE (WIKI & MÉDIAS)                            */}
				{/* ============================================================ */}
				<Card className="relative overflow-hidden border border-[#b78250]/30 shadow-xl bg-linear-to-b from-[#240112] via-[#1a010d] to-[#120008] text-white rounded-3xl p-0 flex flex-col justify-between group transition-all duration-300 hover:border-[#FECD50]/60 hover:shadow-[0_0_40px_-10px_rgba(200,60,81,0.3)]">
					{/* Glows d'ambiance Azalée */}
					<div className="absolute -right-16 -top-16 size-72 bg-[#C83C51] rounded-full blur-[96px] opacity-25 pointer-events-none" />
					<div className="absolute -left-16 -bottom-16 size-72 bg-[#FECD50] rounded-full blur-[96px] opacity-15 pointer-events-none" />

					<CardContent className="p-6 sm:p-8 flex flex-col justify-between h-full space-y-6 relative z-10">
						{/* En-tête de carte */}
						<div className="space-y-4">
							<div className="flex items-center justify-between gap-4">
								<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FECD50]/15 border border-[#FECD50]/30 text-[#FECD50] text-xs font-bold uppercase tracking-wider">
									<BookOpen className="size-3.5" />
									Encyclopédie & Médias
								</div>
								<div className="relative size-12 sm:size-14 shrink-0">
									<Image
										src="/RG_Azalee-logo.webp"
										alt="Logo Azalée"
										fill
										sizes="56px"
										className="object-contain drop-shadow-md"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
									<span className="bg-clip-text text-transparent bg-linear-to-r from-[#FECD50] via-[#ffd67a] to-[#C83C51]">
										Azalée
									</span>
									<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
										Wiki IEVR
									</span>
								</h3>
								<p className="text-sm text-gray-300 leading-relaxed font-light">
									La référence absolue sur <em>Inazuma Eleven: Victory Road</em>. Fiches de personnages,
									techniques spéciales, totems, esprits guerriers, quêtes et actualités décryptées.
								</p>
							</div>

							{/* Compteurs clés Wiki */}
							{wikiStats && (
								<div className="grid grid-cols-3 gap-2 py-3 border-y border-white/10 text-center">
									<div className="p-2 rounded-xl bg-white/5 border border-white/10">
										<div className="text-lg sm:text-xl font-black text-[#FECD50]">
											{wikiStats.characters.toLocaleString("fr-FR")}
										</div>
										<div className="text-[11px] text-gray-400 font-medium">Joueurs</div>
									</div>
									<div className="p-2 rounded-xl bg-white/5 border border-white/10">
										<div className="text-lg sm:text-xl font-black text-[#FECD50]">
											{wikiStats.skills.toLocaleString("fr-FR")}
										</div>
										<div className="text-[11px] text-gray-400 font-medium">Techniques</div>
									</div>
									<div className="p-2 rounded-xl bg-white/5 border border-white/10">
										<div className="text-lg sm:text-xl font-black text-[#FECD50]">
											{wikiStats.items.toLocaleString("fr-FR")}
										</div>
										<div className="text-[11px] text-gray-400 font-medium">Objets</div>
									</div>
								</div>
							)}
						</div>

						{/* Actions : intégrée + site d'origine */}
						<div className="space-y-3 pt-2">
							<Button
								asChild
								size="lg"
								className="w-full bg-white hover:bg-gray-100 text-[#240112] font-black rounded-xl shadow-lg transition-all duration-300 h-12 text-sm sm:text-base group/btn"
							>
								<Link href="/wiki">
									<BookOpen className="size-4 mr-2 text-[#C83C51]" />
									Explorer l'Encyclopédie (Intégrée)
								</Link>
							</Button>

							<div className="flex items-center gap-2">
								<Button
									asChild
									variant="outline"
									size="sm"
									className="flex-1 border-white/20 hover:bg-white/10 text-gray-200 rounded-xl h-10 text-xs font-semibold"
								>
									<a
										href="https://azalee.rosegriffon.fr"
										target="_blank"
										rel="noopener noreferrer"
									>
										<Globe className="size-3.5 mr-1.5" />
										Site d'origine (azalee.rosegriffon.fr)
										<ExternalLink className="size-3 ml-1 opacity-70" />
									</a>
								</Button>
								<Button
									asChild
									variant="ghost"
									size="sm"
									className="text-gray-300 hover:text-white hover:bg-white/10 rounded-xl h-10 px-3 text-xs"
								>
									<a href={azaleeTwitter} target="_blank" rel="noopener noreferrer">
										Actus X
									</a>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* ============================================================ */}
				{/* PILIER 2 : ACHILLÉA (E-SPORT & COMPÉTITION)                  */}
				{/* ============================================================ */}
				<Card className="relative overflow-hidden border border-[#6d00ce]/30 shadow-xl bg-linear-to-b from-[#160d24] via-[#10091c] to-[#0a0512] text-white rounded-3xl p-0 flex flex-col justify-between group transition-all duration-300 hover:border-[#DFFF57]/60 hover:shadow-[0_0_40px_-10px_rgba(223,255,87,0.25)]">
					{/* Glows d'ambiance Achilléa */}
					<div className="absolute -right-16 -top-16 size-72 bg-[#6d00ce] rounded-full blur-[96px] opacity-35 pointer-events-none" />
					<div className="absolute -left-16 -bottom-16 size-72 bg-[#DFFF57] rounded-full blur-[96px] opacity-20 pointer-events-none" />

					<CardContent className="p-6 sm:p-8 flex flex-col justify-between h-full space-y-6 relative z-10">
						{/* En-tête de carte */}
						<div className="space-y-4">
							<div className="flex items-center justify-between gap-4">
								<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6d00ce]/20 border border-[#6d00ce]/40 text-[#DFFF57] text-xs font-bold uppercase tracking-wider">
									<Zap className="size-3.5" />
									E-Sport & Compétition
								</div>
								<div className="relative size-12 sm:size-14 shrink-0">
									<Image
										src="/achillea/logo1.svg"
										alt="Logo Achilléa"
										fill
										className="object-contain drop-shadow-[0_0_10px_rgba(223,255,87,0.5)]"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
									<span className="bg-clip-text text-transparent bg-linear-to-r from-[#DFFF57] via-[#b875ff] to-[#6d00ce]">
										Achilléa
									</span>
									<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#6d00ce]/30 text-[#DFFF57] border border-[#DFFF57]/30">
										E-Sport IEVR
									</span>
								</h3>
								<p className="text-sm text-gray-300 leading-relaxed font-light">
									Le carrefour de l'e-sport officiel Inazuma Eleven. Gestion et annuaire de clans,
									mode classé avec classements ELO 1v1 & 2v2, tournois homologués et Astral League.
								</p>
							</div>

							{/* 4 Piliers compétitifs Achilléa */}
							<div className="grid grid-cols-2 gap-2 py-3 border-y border-white/10">
								<Link
									href="/achillea/clans"
									className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2.5 transition-colors group/item"
								>
									<Users className="size-4 text-[#DFFF57] shrink-0" />
									<div className="min-w-0">
										<div className="text-xs font-bold text-white group-hover/item:text-[#DFFF57] transition-colors truncate">
											Annuaire Clans
										</div>
										<div className="text-[10px] text-gray-400 truncate">Rejoindre / Créer</div>
									</div>
								</Link>
								<Link
									href="/achillea/ranked"
									className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2.5 transition-colors group/item"
								>
									<Swords className="size-4 text-[#DFFF57] shrink-0" />
									<div className="min-w-0">
										<div className="text-xs font-bold text-white group-hover/item:text-[#DFFF57] transition-colors truncate">
											Mode Classé
										</div>
										<div className="text-[10px] text-gray-400 truncate">Ladder ELO & Tiers</div>
									</div>
								</Link>
								<Link
									href="/achillea/tournaments"
									className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2.5 transition-colors group/item"
								>
									<Trophy className="size-4 text-[#DFFF57] shrink-0" />
									<div className="min-w-0">
										<div className="text-xs font-bold text-white group-hover/item:text-[#DFFF57] transition-colors truncate">
											Tournois
										</div>
										<div className="text-[10px] text-gray-400 truncate">Circuit officiel</div>
									</div>
								</Link>
								<Link
									href="/achillea/leagues/astral"
									className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2.5 transition-colors group/item"
								>
									<Shield className="size-4 text-[#DFFF57] shrink-0" />
									<div className="min-w-0">
										<div className="text-xs font-bold text-white group-hover/item:text-[#DFFF57] transition-colors truncate">
											Astral League
										</div>
										<div className="text-[10px] text-gray-400 truncate">Ligue majeure</div>
									</div>
								</Link>
							</div>
						</div>

						{/* Actions : intégrée + site d'origine */}
						<div className="space-y-3 pt-2">
							<Button
								asChild
								size="lg"
								className="w-full bg-[#6d00ce] hover:bg-[#7e14e6] text-[#DFFF57] font-black rounded-xl shadow-[0_0_25px_-5px_rgba(223,255,87,0.4)] border border-[#DFFF57] transition-all duration-300 h-12 text-sm sm:text-base group/btn"
							>
								<Link href="/achillea">
									<Swords className="size-4 mr-2 text-[#DFFF57]" />
									Entrer dans l'E-Sport (Intégré)
								</Link>
							</Button>

							<div className="flex items-center gap-2">
								<Button
									asChild
									variant="outline"
									size="sm"
									className="flex-1 border-[#DFFF57]/30 hover:bg-[#6d00ce]/20 text-gray-200 rounded-xl h-10 text-xs font-semibold"
								>
									<a
										href="https://achillea.rosegriffon.fr"
										target="_blank"
										rel="noopener noreferrer"
									>
										<Globe className="size-3.5 mr-1.5 text-[#DFFF57]" />
										Site d'origine (achillea.rosegriffon.fr)
										<ExternalLink className="size-3 ml-1 opacity-70" />
									</a>
								</Button>
								<Button
									asChild
									variant="ghost"
									size="sm"
									className="text-[#DFFF57] hover:text-white hover:bg-white/10 rounded-xl h-10 px-3 text-xs"
								>
									<a href={achilleaDiscord} target="_blank" rel="noopener noreferrer">
										Discord E-Sport
									</a>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}

export default PillarsDuo;
