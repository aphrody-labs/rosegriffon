"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Play, Pause, Volume2, VolumeX, Music, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@rose-griffon/ui";

interface SoundClip {
	label: string;
	category: "combat" | "histoire" | "emotion";
	file: string;
}

interface Character {
	id: string;
	name: string;
	role: string;
	avatar: string;
	description: string;
	clips: SoundClip[];
}

const CHARACTERS: Character[] = [
	{
		id: "c00001001",
		name: "Yo Shiosawa",
		role: "Protagoniste (Milieu)",
		avatar: "/inazuma-cross/appicon.webp",
		description: "Le nouveau protagoniste de l'histoire originale d'Inazuma Eleven Cross, se déroulant après le tournoi mondial FFI.",
		clips: [
			{ label: "Début de match (GameStart 1)", category: "combat", file: "c00001001_001_c00001001_GameStart.wav" },
			{ label: "Début de match (GameStart 2)", category: "combat", file: "c00001001_002_c00001001_GameStart.wav" },
			{ label: "Phase offensive (Offense)", category: "combat", file: "c00001001_003_c00001001_CommandBattleStartOffense.wav" },
			{ label: "Célébration de but", category: "combat", file: "c00001001_022_c00001001_GoalCelebration.wav" },
			{ label: "Cri de victoire (Win)", category: "combat", file: "c00001001_026_c00001001_Win.wav" },
			{ label: "Sourire (Smile)", category: "emotion", file: "c00001001_028_c00001001_Smile.wav" },
			{ label: "Rire (Laugh)", category: "emotion", file: "c00001001_029_c00001001_Laugh.wav" },
			{ label: "Colère (Angry)", category: "emotion", file: "c00001001_030_c00001001_Angry.wav" },
			{ label: "Excuse (Apology)", category: "histoire", file: "c00001001_049_c00001001_Apology.wav" },
		],
	},
	{
		id: "c00003001",
		name: "Jude Sharp (Kido Yuuto)",
		role: "Milieu / Stratège",
		avatar: "/inazuma-cross/sb-icon-kido.webp",
		description: "Le légendaire meneur de jeu de l'équipe Raimon et d'Inazuma Japan, arborant ses lunettes et sa cape emblématiques.",
		clips: [
			{ label: "Début de match (GameStart)", category: "combat", file: "c00003001_014_c00003001_GameStart.wav" },
			{ label: "Célébration de but", category: "combat", file: "c00003001_036_c00003001_GoalCelebration.wav" },
			{ label: "Éveil (Awake)", category: "combat", file: "c00003001_006_c00003001_Awake.wav" },
			{ label: "Arrivée / Recrutement (Join)", category: "histoire", file: "c00003001_013_c00003001_Join.wav" },
			{ label: "Analyse des détails", category: "histoire", file: "c00003001_002_c00003001_Details.wav" },
			{ label: "Exaspéré (Fed up)", category: "emotion", file: "c00003001_046_c00003001_Fedupwith.wav" },
		],
	},
	{
		id: "c00003021",
		name: "Mark Evans (Endo Mamoru)",
		role: "Gardien / Capitaine",
		avatar: "/inazuma-cross/sb-icon-endo.webp",
		description: "Le gardien de but légendaire qui ne baisse jamais les bras, toujours prêt à encourager ses coéquipiers.",
		clips: [
			{ label: "Début de match (GameStart)", category: "combat", file: "c00003021_003_c00003021_GameStart.wav" },
			{ label: "Célébration de but", category: "combat", file: "c00003021_007_c00003021_GoalCelebration.wav" },
			{ label: "Interception (Passcut)", category: "combat", file: "c00003021_002_c00003021_Passcut.wav" },
			{ label: "Technique universelle", category: "combat", file: "c00003021_009_c00003021_UniversalMove.wav" },
			{ label: "But concédé", category: "combat", file: "c00003021_012_c00003021_GoalConceded.wav" },
			{ label: "À terre (Down)", category: "emotion", file: "c00003021_013_c00003021_Down.wav" },
		],
	},
];

export function AudioShowcase() {
	const [activeChar, setActiveChar] = useState<Character>(CHARACTERS[0]);
	const [playingClip, setPlayingClip] = useState<string | null>(null);
	const [volume, setVolume] = useState<number>(0.7);
	const [isMuted, setIsMuted] = useState<boolean>(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	// Initialisation audio
	useEffect(() => {
		audioRef.current = new Audio();
		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
			}
		};
	}, []);

	// Gérer le volume
	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.volume = isMuted ? 0 : volume;
		}
	}, [volume, isMuted]);

	const playSound = (file: string) => {
		if (!audioRef.current) return;

		const audioPath = `/inazuma-cross/audio/${file}`;

		if (playingClip === file) {
			audioRef.current.pause();
			setPlayingClip(null);
		} else {
			audioRef.current.src = audioPath;
			audioRef.current.play()
				.then(() => {
					setPlayingClip(file);
				})
				.catch((err) => {
					console.error("Erreur de lecture audio :", err);
				});

			audioRef.current.onended = () => {
				setPlayingClip(null);
			};
		}
	};

	const toggleMute = () => {
		setIsMuted(!isMuted);
	};

	return (
		<Card className="border-2 bg-surface-container-low shadow-md" style={{ borderColor: "#00aeef80" }}>
			<CardHeader className="pb-4">
				<CardTitle className="type-headline-small flex items-center gap-3 text-primary">
					<Music className="size-6 text-[#00aeef]" />
					Démonstrateur de Voix Réelles (PoC)
				</CardTitle>
				<p className="type-body-medium text-on-surface-variant">
					Écoutez les voix japonaises originales extraites et décodées des fichiers du jeu (fichiers audio réels CRI HCA décodés en WAV).
				</p>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Sélecteur de personnage */}
				<div className="flex flex-wrap gap-3">
					{CHARACTERS.map((char) => (
						<button
							key={char.id}
							onClick={() => {
								setActiveChar(char);
								if (audioRef.current) {
									audioRef.current.pause();
								}
								setPlayingClip(null);
							}}
							className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-all duration-300 ${
								activeChar.id === char.id
									? "border-[#00aeef] bg-primary-container text-on-primary-container shadow-sm scale-105"
									: "border-outline-variant/30 bg-surface hover:bg-surface-container-high"
							}`}
						>
							<div className="relative size-10 overflow-hidden rounded-full border border-[#00aeef]/40 bg-surface-container-high">
								<Image
									src={char.avatar}
									alt={char.name}
									fill
									sizes="40px"
									className="object-cover"
								/>
							</div>
							<div>
								<div className="type-label-large font-bold">{char.name}</div>
								<div className="type-body-small opacity-70">{char.role}</div>
							</div>
						</button>
					))}
				</div>

				{/* Fiche personnage active & Contrôleur de volume */}
				<div className="grid grid-cols-1 gap-6 rounded-2xl bg-surface p-5 border border-outline-variant/20 md:grid-cols-[1fr_200px]">
					<div>
						<div className="flex items-center gap-2 mb-2">
							<Badge className="bg-secondary-container text-on-secondary-container">
								Actif
							</Badge>
							<span className="type-title-medium font-bold text-primary">{activeChar.name}</span>
						</div>
						<p className="type-body-medium text-on-surface-variant">{activeChar.description}</p>
					</div>

					<div className="flex flex-col justify-center gap-2 border-t border-outline-variant/20 pt-4 md:border-t-0 md:border-l md:pl-6 md:pt-0">
						<div className="flex items-center gap-2 text-on-surface-variant">
							<button onClick={toggleMute} className="hover:text-primary transition-colors">
								{isMuted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
							</button>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={volume}
								onChange={(e) => {
									setVolume(parseFloat(e.target.value));
									setIsMuted(false);
								}}
								className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-high accent-[#00aeef]"
							/>
						</div>
						<div className="text-[10px] text-center text-on-surface-variant/70 font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
							<CheckCircle2 className="size-3 text-success" />
							Fichiers Extraits Vérifiés
						</div>
					</div>
				</div>

				{/* Liste des clips audio */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
					{activeChar.clips.map((clip) => {
						const isPlaying = playingClip === clip.file;
						let categoryColor = "bg-primary-container text-on-primary-container";
						if (clip.category === "histoire") {
							categoryColor = "bg-secondary-container text-on-secondary-container";
						} else if (clip.category === "emotion") {
							categoryColor = "bg-tertiary-container text-on-tertiary-container";
						}

						return (
							<button
								key={clip.file}
								onClick={() => playSound(clip.file)}
								className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all duration-300 ${
									isPlaying
										? "border-[#00aeef] bg-primary-container/20 shadow-sm scale-[1.02]"
										: "border-outline-variant/30 bg-surface hover:bg-surface-container-high"
								}`}
							>
								<div className="space-y-1">
									<div className="type-label-medium font-bold text-on-surface">{clip.label}</div>
									<Badge className={`text-[10px] uppercase font-bold py-0 ${categoryColor}`}>
										{clip.category}
									</Badge>
								</div>
								<div className={`flex size-9 items-center justify-center rounded-full transition-transform ${
									isPlaying ? "bg-[#00aeef] text-white rotate-180" : "bg-surface-container-high text-on-surface-variant hover:text-primary"
								}`}>
									{isPlaying ? <Pause className="size-4" /> : <Play className="size-4" fill="currentColor" />}
								</div>
							</button>
						);
					})}
				</div>

				{/* Visualisation de l'animation de l'onde */}
				{playingClip && (
					<div className="flex items-center justify-center gap-1 py-2">
						{[...Array(12)].map((_, i) => (
							<div
								key={i}
								className="w-1 bg-[#00aeef] rounded-full animate-bounce"
								style={{
									height: `${Math.random() * 24 + 8}px`,
									animationDuration: `${Math.random() * 0.8 + 0.4}s`,
									animationDelay: `${i * 0.05}s`,
								}}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
