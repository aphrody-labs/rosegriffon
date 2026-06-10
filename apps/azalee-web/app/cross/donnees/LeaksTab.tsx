/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import React, { useState } from "react";
import { 
	Zap, Flame, ShieldAlert, Sparkles, Swords, Info, HelpCircle, 
	Shirt, ChevronRight, Award, Trophy, Compass, MessageSquare 
} from "lucide-react";
import { CROSS_CYAN } from "@/lib/cross/data-shared";

interface LeaksTabProps {
	dev: boolean;
}

export function LeaksTab({ dev }: LeaksTabProps) {
	const [activeSection, setActiveSection] = useState<"chara" | "battle" | "club" | "progression">("chara");

	// Mappings for visualization
	const elements = [
		{ name: "Vent (Wind)", fr: "Air", color: "#00aeef", icon: "💨", desc: "Avantageux contre la Montagne" },
		{ name: "Forêt (Forest)", fr: "Bois", color: "#10b981", icon: "🍃", desc: "Avantageux contre le Vent" },
		{ name: "Feu (Fire)", fr: "Feu", color: "#f59e0b", icon: "🔥", desc: "Avantageux contre la Forêt" },
		{ name: "Montagne (Mountain)", fr: "Terre", color: "#b45309", icon: "⛰️", desc: "Avantageux contre le Feu" },
	];

	const shapes = [
		{ category: "Hommes", types: ["Moyen (MaleAverage)", "Petit (MaleSmall)", "Rond (MaleFat)", "Grand (MaleTall)", "Athlétique (MaleMuscular)", "Costaud (MaleLarge)"] },
		{ category: "Femmes", types: ["Moyenne (FemaleAverage)", "Petite (FemaleSmall)", "Ronde (FemaleFat)", "Grande (FemaleTall)", "Athlétique (FemaleMuscular)", "Costaude (FemaleLarge)"] }
	];

	const slotTypes = [
		{ name: "Peluche (StuffedToy)", desc: "Décorez les étagères ou les tables avec des peluches des mascottes." },
		{ name: "Trophée (Trophy)", desc: "Exposez vos coupes et victoires en tournoi multijoueur." },
		{ name: "Art Mural (WallArt)", desc: "Affiches, posters et décorations sur les murs du club." },
		{ name: "Tapis (Carpet)", desc: "Personnalisez le sol du club-house avec différents motifs." }
	];

	return (
		<div className="space-y-6">
			{/* Banner Leaks */}
			<div className="rounded-2xl bg-[#00aeef]/10 border border-[#00aeef]/30 p-4 flex items-start gap-3">
				<Zap className="text-[#00aeef] shrink-0 mt-0.5" size={20} />
				<div>
					<h3 className="font-bold text-sm text-on-surface">Base de Données et Mécaniques Dévoilées</h3>
					<p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
						Ces informations proviennent directement de l'analyse du code binaire C++ compilé (IL2CPP) du jeu mobile. Elles révèlent en exclusivité des systèmes de jeu non encore documentés pour le grand public.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-start">
				{/* Sidebar Navigation */}
				<div className="flex md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-2 whitespace-nowrap">
					<button
						onClick={() => setActiveSection("chara")}
						className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border transition-all text-left ${
							activeSection === "chara"
								? "bg-[#00aeef] text-white border-[#00aeef] shadow-sm"
								: "bg-surface-container hover:bg-surface-container-high border-outline-variant/30 text-on-surface"
						}`}
					>
						<Sparkles size={16} />
						<span>Joueurs & Attributs</span>
					</button>
					<button
						onClick={() => setActiveSection("battle")}
						className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border transition-all text-left ${
							activeSection === "battle"
								? "bg-[#00aeef] text-white border-[#00aeef] shadow-sm"
								: "bg-surface-container hover:bg-surface-container-high border-outline-variant/30 text-on-surface"
						}`}
					>
						<Swords size={16} />
						<span>Supertechniques & Matchs</span>
					</button>
					<button
						onClick={() => setActiveSection("club")}
						className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border transition-all text-left ${
							activeSection === "club"
								? "bg-[#00aeef] text-white border-[#00aeef] shadow-sm"
								: "bg-surface-container hover:bg-surface-container-high border-outline-variant/30 text-on-surface"
						}`}
					>
						<Trophy size={16} />
						<span>Club-house & Vie de Club</span>
					</button>
					<button
						onClick={() => setActiveSection("progression")}
						className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border transition-all text-left ${
							activeSection === "progression"
								? "bg-[#00aeef] text-white border-[#00aeef] shadow-sm"
								: "bg-surface-container hover:bg-surface-container-high border-outline-variant/30 text-on-surface"
						}`}
					>
						<Award size={16} />
						<span>Éveil & Progression</span>
					</button>
				</div>

				{/* Content Window */}
				<div className="space-y-6">
					{/* Section 1: Joueurs & Attributs */}
					{activeSection === "chara" && (
						<div className="space-y-6 animate-in fade-in duration-300">
							<div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5 space-y-4">
								<h3 className="text-base font-black text-on-surface flex items-center gap-2">
									<Sparkles className="text-[#00aeef]" size={18} />
									Fiche Technique des Joueurs
								</h3>
								<p className="text-xs text-on-surface-variant leading-relaxed">
									Le code du jeu définit des attributs inédits et extrêmement détaillés pour la gestion physique et psychologique de chaque membre du club.
								</p>

								{/* Personalities & Chests */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
									<div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
										<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
											Personnalités Révélées (CharacterPersonality)
										</h4>
										<p className="text-[11px] text-on-surface-variant leading-relaxed mb-3">
											Chaque joueur possède un tempérament influençant son IA et ses réactions en match :
										</p>
										<div className="grid grid-cols-2 gap-2 text-xs font-semibold">
											<span className="bg-surface-container px-2 py-1.5 rounded-lg border border-outline-variant/20 text-center">🔥 Fonceur (Daring)</span>
											<span className="bg-surface-container px-2 py-1.5 rounded-lg border border-outline-variant/20 text-center">❄️ Calme (Cool)</span>
											<span className="bg-surface-container px-2 py-1.5 rounded-lg border border-outline-variant/20 text-center">☀️ Joyeux (Cheerful)</span>
											<span className="bg-surface-container px-2 py-1.5 rounded-lg border border-outline-variant/20 text-center">✨ Élégant (Elegant)</span>
										</div>
									</div>

									<div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
										<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
											Customisation Physique (ChestSize)
										</h4>
										<p className="text-[11px] text-on-surface-variant leading-relaxed mb-3">
											Le moteur 3D gère dynamiquement trois variantes de corpulence de poitrine pour les personnages féminins, une première dans la série mobile :
										</p>
										<div className="grid grid-cols-3 gap-2 text-xs font-semibold text-center">
											<span className="bg-surface-container py-1.5 rounded-lg border border-outline-variant/20">Petit</span>
											<span className="bg-surface-container py-1.5 rounded-lg border border-outline-variant/20">Moyen</span>
											<span className="bg-surface-container py-1.5 rounded-lg border border-outline-variant/20">Grand</span>
										</div>
									</div>
								</div>

								{/* Elements matchups */}
								<div className="space-y-3 pt-2">
									<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
										<Flame size={14} className="text-primary" />
										Les 4 Éléments et forces (CharacterElement)
									</h4>
									<p className="text-[11px] text-on-surface-variant leading-relaxed">
										Comme dans les grands opus, le système d'affinité élémentaire influe sur les duels et les supertechniques :
									</p>
									<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
										{elements.map((el) => (
											<div key={el.name} className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest flex items-center gap-3">
												<span className="text-2xl">{el.icon}</span>
												<div>
													<div className="text-xs font-black" style={{ color: el.color }}>{el.fr}</div>
													<div className="text-[10px] text-on-surface-variant">{el.desc}</div>
												</div>
											</div>
										))}
									</div>
								</div>

								{/* Shapes & meshes */}
								<div className="space-y-3 pt-2">
									<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
										Gabarits 3D & Silhouettes (CharacterShape)
									</h4>
									<p className="text-[11px] text-on-surface-variant leading-relaxed">
										Il existe 18 gabarits physiques différents programmés dans le jeu (mêlant taille, musculature, cou épais et silhouettes). Ils sont ensuite interpolés en jeu sur 4 squelettes principaux 3D (Fbx) :
									</p>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{shapes.map((sh) => (
											<div key={sh.category} className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest space-y-2">
												<div className="text-xs font-black text-[#00aeef]">{sh.category}</div>
												<div className="flex flex-wrap gap-1.5">
													{sh.types.map((type) => (
														<span key={type} className="bg-surface-container px-2 py-0.5 rounded text-[10px] text-on-surface-variant font-mono">
															{type.split(" ")[0]}
														</span>
													))}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Section 2: Supertechniques & Matchs */}
					{activeSection === "battle" && (
						<div className="space-y-6 animate-in fade-in duration-300">
							<div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5 space-y-4">
								<h3 className="text-base font-black text-on-surface flex items-center gap-2">
									<Swords className="text-[#00aeef]" size={18} />
									Mécaniques de Duel & Supertechniques (Hissatsu)
								</h3>
								<p className="text-xs text-on-surface-variant leading-relaxed">
									L'analyse des classes de combat de Unity révèle comment sont orchestrés les matchs et la puissance des techniques.
								</p>

								{/* Key features list */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
										<div className="flex items-center gap-2">
											<span className="p-1.5 rounded-lg bg-[#00aeef]/10 text-[#00aeef]">
												<Zap size={14} />
											</span>
											<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
												Chaînes de Techniques (Move Chains)
											</h4>
										</div>
										<p className="text-[11px] text-on-surface-variant leading-relaxed">
											Le code contient des classes d'exception et de vérification pour les <strong>Move Chains</strong>. Cela prouve que le jeu intègre le système emblématique permettant d'enchaîner plusieurs tirs de supertechniques pour augmenter leur puissance avant d'atteindre le gardien.
										</p>
									</div>

									<div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
										<div className="flex items-center gap-2">
											<span className="p-1.5 rounded-lg bg-[#00aeef]/10 text-[#00aeef]">
												<Shirt size={14} />
											</span>
											<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
												Manuscrits d'Apprentissage (Manuals)
											</h4>
										</div>
										<p className="text-[11px] text-on-surface-variant leading-relaxed">
											La présence de la classe <code className="font-mono text-xs text-[#00aeef]">ManualSpecialMoveLearnCountCondition</code> confirme que vous pourrez enseigner manuellement de nouvelles techniques aux joueurs via des parchemins ou manuscrits, au lieu d'être limité à leur set naturel.
										</p>
									</div>
								</div>

								{/* Audio cues during matches */}
								<div className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest space-y-3">
									<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
										<MessageSquare size={14} className="text-[#00aeef]" />
										Déclencheurs de Voix en Match (VoiceType)
									</h4>
									<p className="text-[11px] text-on-surface-variant leading-relaxed">
										Les fichiers de voix audio (ACB/AWB) décodés contiennent des clips associés à des actions de jeu très précises identifiées dans les énumérations :
									</p>
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
										<div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
											<div className="font-bold">Pass</div>
											<div className="text-[9px] text-on-surface-variant/80">Passe simple</div>
										</div>
										<div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
											<div className="font-bold">PassCut</div>
											<div className="text-[9px] text-on-surface-variant/80">Interception</div>
										</div>
										<div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
											<div className="font-bold">BeforeShootMove</div>
											<div className="text-[9px] text-on-surface-variant/80">Lancement Tir</div>
										</div>
										<div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
											<div className="font-bold">KeeperPass</div>
											<div className="text-[9px] text-on-surface-variant/80">Relance Gardien</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{/* Section 3: Club-house & Vie de Club */}
					{activeSection === "club" && (
						<div className="space-y-6 animate-in fade-in duration-300">
							<div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5 space-y-4">
								<h3 className="text-base font-black text-on-surface flex items-center gap-2">
									<Trophy className="text-[#00aeef]" size={18} />
									Vie de Club & Club-house Personnalisable
								</h3>
								<p className="text-xs text-on-surface-variant leading-relaxed">
									En plus du football sur le terrain, le jeu intègre un espace de club entièrement personnalisable pour vos joueurs.
								</p>

								{/* Slot types */}
								<div className="space-y-3">
									<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
										Emplacements de Décoration (ClubHouseDecorationSlotType)
									</h4>
									<p className="text-[11px] text-on-surface-variant leading-relaxed">
										Quatre catégories d'objets décoratifs ont été découvertes dans les fichiers de configuration du club-house :
									</p>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{slotTypes.map((slot) => (
											<div key={slot.name} className="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest flex items-start gap-3">
												<ChevronRight size={16} className="text-[#00aeef] shrink-0 mt-0.5" />
												<div>
													<div className="text-xs font-bold text-on-surface">{slot.name.split(" ")[0]}</div>
													<div className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">{slot.desc}</div>
												</div>
											</div>
										))}
									</div>
								</div>

								{/* Inalink & Social */}
								<div className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low space-y-2">
									<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
										<MessageSquare size={14} className="text-[#00aeef]" />
										Messagerie Inalink & Guildes
									</h4>
									<p className="text-[11px] text-on-surface-variant leading-relaxed">
										Le réseau social interne <strong>Inalink</strong> vous permettra d'échanger avec vos personnages préférés. Il supporte le tri des messages non lus et les tampons de chat (ChatStampMaster). De plus, les guildes de joueurs intègrent des politiques d'admission (recrutement compétitif ou ouvert à tous).
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Section 4: Éveil & Progression */}
					{activeSection === "progression" && (
						<div className="space-y-6 animate-in fade-in duration-300">
							<div className="rounded-2xl border border-outline-variant/40 bg-surface-container p-5 space-y-4">
								<h3 className="text-base font-black text-on-surface flex items-center gap-2">
									<Award className="text-[#00aeef]" size={18} />
									Systèmes d'Éveil et Multiplicateurs de Stats
								</h3>
								<p className="text-xs text-on-surface-variant leading-relaxed">
									La progression statistique de vos joueurs repose sur le système d'Éveil (Awakening), qui multiplie directement leurs capacités de base.
								</p>

								{/* Multipliers card */}
								<div className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest space-y-3">
									<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
										<Award size={14} className="text-[#00aeef]" />
										Multiplicateurs d'Éveil (AwakeningTierMaster)
									</h4>
									<p className="text-[11px] text-on-surface-variant leading-relaxed">
										Chaque palier d'éveil d'un joueur applique un coefficient multiplicateur sur ses statistiques clés :
									</p>
									<div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
										<div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
											<div className="font-bold text-[#00aeef]">KickMultiplier</div>
											<div className="text-[10px] text-on-surface-variant/80 mt-1">Multiplicateur de Tir</div>
										</div>
										<div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
											<div className="font-bold text-[#00aeef]">TechniqueMultiplier</div>
											<div className="text-[10px] text-on-surface-variant/80 mt-1">Multiplicateur Technique</div>
										</div>
										<div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
											<div className="font-bold text-[#00aeef]">BlockMultiplier</div>
											<div className="text-[10px] text-on-surface-variant/80 mt-1">Multiplicateur de Défense</div>
										</div>
										<div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20">
											<div className="font-bold text-[#00aeef]">CatchMultiplier</div>
											<div className="text-[10px] text-on-surface-variant/80 mt-1">Multiplicateur d'Arrêt</div>
										</div>
										<div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20 col-span-2 sm:col-span-1">
											<div className="font-bold text-[#00aeef]">SpeedMultiplier</div>
											<div className="text-[10px] text-on-surface-variant/80 mt-1">Multiplicateur de Vitesse</div>
										</div>
									</div>
								</div>

								{/* Battle Pass */}
								<div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
									<h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
										Système de Passes (BattlePass & BonusPass)
									</h4>
									<p className="text-[11px] text-on-surface-variant leading-relaxed">
										Les tables <code className="font-mono text-xs text-[#00aeef]">BattlePassMaster</code> et <code className="font-mono text-xs text-[#00aeef]">BonusPassMaster</code> révèlent que le jeu dispose d'un système de passe de combat saisonnier avec des niveaux d'expérience et des récompenses débloquées au fur et à mesure de votre progression.
									</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
