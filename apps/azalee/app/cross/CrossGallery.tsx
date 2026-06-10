"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Image as ImageIcon, View, ShieldCheck, BadgeInfo, Layers, Maximize2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@rose-griffon/ui";

interface AssetTab {
	id: string;
	label: string;
	icon: React.ReactNode;
}

const TABS: AssetTab[] = [
	{ id: "cbt", label: "Captures Bêta (CBT)", icon: <ImageIcon className="size-4" /> },
	{ id: "collab", label: "Uniformes & Collab JFA", icon: <Layers className="size-4" /> },
	{ id: "chars", label: "Personnages PNG", icon: <ShieldCheck className="size-4" /> },
	{ id: "models3d", label: "Structures 3D & Meshes", icon: <View className="size-4" /> },
];

const CBT_SCREENSHOTS = [
	{ src: "/inazuma-cross/cbt-ss1.webp", desc: "Écran de match - Vue du terrain" },
	{ src: "/inazuma-cross/cbt-ss2.webp", desc: "Phase offensive de duel" },
	{ src: "/inazuma-cross/cbt-ss3.webp", desc: "Configuration de la formation" },
	{ src: "/inazuma-cross/cbt-ss4.webp", desc: "Écran d'entraînement individuel" },
	{ src: "/inazuma-cross/cbt-ss5.webp", desc: "Sélection des joueurs" },
	{ src: "/inazuma-cross/cbt-ss6.webp", desc: "Cinématique d'histoire" },
	{ src: "/inazuma-cross/cbt-ss7.webp", desc: "Dialogue en mode histoire" },
	{ src: "/inazuma-cross/cbt-ss8.webp", desc: "Menu principal RPG" },
	{ src: "/inazuma-cross/cbt-ss9.webp", desc: "Statistiques et équipements" },
	{ src: "/inazuma-cross/cbt-ss10.webp", desc: "Mode d'entraînement tactique" },
];

const COLLAB_SLIDES = [
	"/inazuma-cross/sb-slide1.webp",
	"/inazuma-cross/sb-slide2.webp",
	"/inazuma-cross/sb-slide3.webp",
];

const CHAR_PNGS = [
	{
		name: "Yo Shiosawa",
		role: "Protagoniste",
		file: "/inazuma-cross/intro-character.webp",
		desc: "Protagoniste principal, illustration officielle extraite.",
	},
	{
		name: "Jude Sharp",
		role: "Milieu",
		file: "/inazuma-cross/sb-chara-kido.webp",
		desc: "Version collaboration Samurai Blue JFA.",
	},
	{
		name: "Mark Evans",
		role: "Gardien",
		file: "/inazuma-cross/sb-chara-endo.webp",
		desc: "Version collaboration Samurai Blue JFA.",
	},
];

export function CrossGallery() {
	const [activeTab, setActiveTab] = useState<string>("cbt");
	const [lightboxImage, setLightboxImage] = useState<string | null>(null);

	return (
		<Card className="border-2 bg-surface-container-low shadow-md" style={{ borderColor: "#00aeef80" }}>
			<CardHeader className="pb-4 border-b border-outline-variant/20">
				<CardTitle className="type-headline-small flex items-center gap-3 text-primary">
					<ImageIcon className="size-6 text-[#00aeef]" />
					Démonstrateur d'Assets Véridiques
				</CardTitle>
				<p className="type-body-medium text-on-surface-variant">
					Visualisez les images réelles (PNG/WebP), les captures d'écran de jeu, et la structure des maillages 3D extraits directement des fichiers du client de jeu.
				</p>
			</CardHeader>
			<CardContent className="pt-6 space-y-6">
				{/* Onglets */}
				<div className="flex flex-wrap gap-2 border-b border-outline-variant/10 pb-4">
					{TABS.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex items-center gap-2 rounded-xl px-4 py-2.5 type-label-large font-bold transition-all duration-300 ${
								activeTab === tab.id
									? "bg-primary text-on-primary shadow-sm scale-105"
									: "bg-surface hover:bg-surface-container-high text-on-surface-variant"
							}`}
						>
							{tab.icon}
							{tab.label}
						</button>
					))}
				</div>

				{/* Contenu de l'onglet : Captures CBT */}
				{activeTab === "cbt" && (
					<div className="space-y-4">
						<div className="flex items-center gap-2 text-on-surface-variant">
							<Badge className="bg-primary-container text-on-primary-container">Vérifié</Badge>
							<span className="type-body-medium">10 captures d'écran réelles extraites de l'enquête CBT officielle de juin 2026.</span>
						</div>
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
							{CBT_SCREENSHOTS.map((img, i) => (
								<div
									key={i}
									onClick={() => setLightboxImage(img.src)}
									className="group relative aspect-[16/9] overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-high cursor-pointer transition-all hover:scale-[1.03]"
								>
									<Image
										src={img.src}
										alt={img.desc}
										fill
										sizes="(max-width: 640px) 45vw, 18vw"
										className="object-cover"
									/>
									<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
										<Maximize2 className="size-5 text-white" />
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Contenu de l'onglet : Collab JFA */}
				{activeTab === "collab" && (
					<div className="space-y-6">
						<div className="flex items-center gap-2 text-on-surface-variant">
							<Badge className="bg-secondary-container text-on-secondary-container">Samurai Blue 2026</Badge>
							<span className="type-body-medium">Affiches et diapositives des uniformes de l'équipe nationale du JFA extraites des bundles.</span>
						</div>
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
							{COLLAB_SLIDES.map((src, i) => (
								<div
									key={i}
									onClick={() => setLightboxImage(src)}
									className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-high cursor-pointer transition-all hover:scale-[1.02]"
								>
									<Image
										src={src}
										alt={`Uniforme ${i + 1}`}
										fill
										sizes="(max-width: 768px) 90vw, 30vw"
										className="object-cover"
									/>
									<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
										<Maximize2 className="size-6 text-white" />
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Contenu de l'onglet : Personnages PNG */}
				{activeTab === "chars" && (
					<div className="space-y-6">
						<div className="flex items-center gap-2 text-on-surface-variant">
							<Badge className="bg-tertiary-container text-on-tertiary-container">PNG Transparent</Badge>
							<span className="type-body-medium">Rendus 2D officiels extraits des bundles d'assets UI du jeu.</span>
						</div>
						<div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
							{CHAR_PNGS.map((char) => (
								<Card key={char.name} className="overflow-hidden border border-outline-variant/20 bg-surface-container-low shadow-sm">
									<div className="relative aspect-[4/5] bg-[#0c1730]/90">
										<Image
											src={char.file}
											alt={char.name}
											fill
											sizes="(max-width: 768px) 90vw, 30vw"
											className="object-contain p-4"
										/>
									</div>
									<CardHeader className="p-4">
										<div className="flex items-center justify-between">
											<CardTitle className="type-title-medium font-bold">{char.name}</CardTitle>
											<Badge className="bg-primary text-on-primary">{char.role}</Badge>
										</div>
									</CardHeader>
									<CardContent className="px-4 pb-4 pt-0">
										<p className="type-body-small text-on-surface-variant">{char.desc}</p>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				)}

				{/* Contenu de l'onglet : Structures 3D */}
				{activeTab === "models3d" && (
					<div className="space-y-6">
						<div className="flex items-center gap-2 text-on-surface-variant">
							<Badge className="bg-primary-container text-on-primary-container">Maillages extraits</Badge>
							<span className="type-body-medium">Cartographie de l'index des maillages 3D physiques présents au sein des AssetBundles.</span>
						</div>

						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							<div className="bg-surface px-4 py-5 rounded-2xl text-center border border-outline-variant/30">
								<div className="type-headline-medium font-bold text-[#00aeef]">1 263</div>
								<div className="type-label-large text-on-surface-variant/80 font-bold uppercase mt-1">Meshes 3D</div>
								<p className="type-body-small text-on-surface-variant/60 mt-1">Modèles 3D géométriques des personnages, ballons, stades et terrains.</p>
							</div>
							<div className="bg-surface px-4 py-5 rounded-2xl text-center border border-outline-variant/30">
								<div className="type-headline-medium font-bold text-[#00aeef]">5 238</div>
								<div className="type-label-large text-on-surface-variant/80 font-bold uppercase mt-1">GameObjects</div>
								<p className="type-body-small text-on-surface-variant/60 mt-1">Préfabriqués reliant les meshes aux scripts, animations et sons.</p>
							</div>
							<div className="bg-surface px-4 py-5 rounded-2xl text-center border border-outline-variant/30">
								<div className="type-headline-medium font-bold text-[#00aeef]">3 338</div>
								<div className="type-label-large text-on-surface-variant/80 font-bold uppercase mt-1">Materials</div>
								<p className="type-body-small text-on-surface-variant/60 mt-1">Matériaux définissant le rendu, les reflets et textures de surface.</p>
							</div>
							<div className="bg-surface px-4 py-5 rounded-2xl text-center border border-outline-variant/30">
								<div className="type-headline-medium font-bold text-[#00aeef]">1 113</div>
								<div className="type-label-large text-on-surface-variant/80 font-bold uppercase mt-1">Animations</div>
								<p className="type-body-small text-on-surface-variant/60 mt-1">Clips d'animation pour les mouvements, passes et tirs hissatsu.</p>
							</div>
						</div>

						<div className="rounded-2xl border border-outline-variant/20 bg-surface p-5 flex gap-4">
							<BadgeInfo className="size-6 text-[#00aeef] shrink-0 mt-0.5" />
							<div>
								<h4 className="type-title-medium font-bold text-primary">Preuve de Concept Technique (3D Meshes)</h4>
								<p className="type-body-medium text-on-surface-variant mt-1">
									Les maillages géométriques 3D sont empaquetés au sein de <strong>2 081 AssetBundles physiques</strong> (représentant 2.05 Go de données). L'architecture IL2CPP sous Unity 6000 permet d'associer ces meshes aux textures correspondantes du dossier <code>public/inazuma-cross/textures/</code> pour reconstituer les modèles de jeu originaux.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Lightbox / Zoom image */}
				{lightboxImage && (
					<div
						className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 transition-all duration-300"
						onClick={() => setLightboxImage(null)}
					>
						<button
							className="absolute right-4 top-4 text-white hover:text-primary transition-colors"
							onClick={() => setLightboxImage(null)}
						>
							<X className="size-8" />
						</button>
						<div
							className="relative aspect-auto max-h-[85vh] max-w-[95vw] w-full h-full"
							onClick={(e) => e.stopPropagation()}
						>
							<Image
								src={lightboxImage}
								alt="Zoom asset"
								fill
								sizes="95vw"
								className="object-contain"
							/>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
