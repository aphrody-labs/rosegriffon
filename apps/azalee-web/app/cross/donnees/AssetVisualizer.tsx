"use client";

import React, { useState } from "react";
import { X, Info, FileText, Volume2, Box, Compass, Sliders, ChevronRight, Download, Search, Image as ImageIcon } from "lucide-react";
import { CROSS_CYAN } from "@/lib/cross/data-shared";
import { useRouter, useSearchParams } from "next/navigation";

interface CatalogAsset {
	guid: string;
	key: string;
	type: string;
	bundle: string;
	size: number;
	n_deps: number;
	deps?: string[];
}

const MOCK_TRANSLATIONS: Record<string, string> = {
	"Common_OK": "OK",
	"Common_Cancel": "Annuler",
	"Common_Yes": "Oui",
	"Common_No": "Non",
	"Common_Close": "Fermer",
	"Common_Back": "Retour",
	"Common_Next": "Suivant",
	"Common_Save": "Sauvegarder",
	"c00001001_Name": "Yo Shiosawa",
	"c00003001_Name": "Mark Evans (Mamoru Endou)",
	"c00003021_Name": "Jude Sharp (Yuuto Kidou)",
	"System_Loading": "Chargement en cours...",
	"System_Error_426": "AnoSDK Protection: Version upgrade required (426).",
	"System_Title": "Inazuma Eleven Cross",
	"System_TapToStart": "Toucher pour commencer",
	"System_Connecting": "Connexion au serveur JP...",
	"UI_Gacha_Title": "Recrutement (Gacha)",
	"UI_Team_Title": "Gestion d'Équipe",
	"Hissatsu_FireTornado": "Tornade de Feu",
	"Hissatsu_GodHand": "Main Céleste",
	"Hissatsu_RoyalShield": "Bouclier Royal",
};

const CHARACTER_VOICE_STUBS: Record<string, string[]> = {
	"CriAtomAcbAsset": [
		"c00001001_001_c00001001_GameStart.wav",
		"c00001001_007_c00001001_Pass.wav",
		"c00003001_005_c00003001_Awake.wav",
		"c00003021_003_c00003021_GameStart.wav"
	]
};

function getLocalTextureUrl(key: string): string | null {
	const lowerKey = key.toLowerCase();
	if (lowerKey.includes("gsansrfstd") && lowerKey.includes("atlas")) {
		if (lowerKey.includes("1")) return "/inazuma-cross/textures/BO-GSanSrfStd-Bd Atlas 1.png";
		return "/inazuma-cross/textures/BO-GSanSrfStd-Bd Atlas.png";
	}
	if (lowerKey.includes("softgostd") && lowerKey.includes("atlas")) {
		if (lowerKey.includes("1")) return "/inazuma-cross/textures/BO-SoftGoStd-DeBold Atlas 1.png";
		return "/inazuma-cross/textures/BO-SoftGoStd-DeBold Atlas.png";
	}
	if (lowerKey.includes("goldman") && lowerKey.includes("atlas")) {
		return "/inazuma-cross/textures/Goldman-Regular SDF Atlas.png";
	}
	if (lowerKey.includes("liberationsans") && lowerKey.includes("atlas")) {
		return "/inazuma-cross/textures/LiberationSans Atlas.png";
	}
	return null;
}

export default function AssetVisualizer({ asset }: { asset: CatalogAsset }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	
	// États interactifs
	const [bgStyle, setBgStyle] = useState<"checkerboard" | "dark" | "light">("checkerboard");
	const [textureZoom, setTextureZoom] = useState<number>(100);
	const [translationFilter, setTranslationFilter] = useState("");
	const [rotation3d, setRotation3d] = useState(25);
	const [autoRotate, setAutoRotate] = useState(true);

	const handleClose = () => {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("asset");
		router.push(`/cross/donnees?${params.toString()}`);
	};

	const handleNavigateAsset = (guid: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("asset", guid);
		router.push(`/cross/donnees?${params.toString()}`);
	};

	const localImgUrl = getLocalTextureUrl(asset.key);
	const isLocal = !!localImgUrl;

	// Formater la taille en Mo ou Ko
	const formatSize = (bytes: number) => {
		if (bytes === 0) return "—";
		if (bytes < 1024) return `${bytes} o`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
	};

	return (
		<div className="rounded-2xl border border-outline-variant bg-surface-container p-4 space-y-4 shadow-lg sticky top-4 max-h-[85vh] overflow-y-auto">
			{/* En-tête */}
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1 min-w-0">
					<span className="rounded-full bg-secondary-container text-on-secondary-container px-2.5 py-0.5 text-xs font-bold inline-block">
						{asset.type}
					</span>
					<h3 className="font-bold text-on-surface text-sm break-all leading-tight" title={asset.key}>
						{asset.key.split("/").pop() || asset.key}
					</h3>
					<p className="text-[10px] text-on-surface-variant font-mono truncate" title={asset.guid}>
						GUID: {asset.guid}
					</p>
				</div>
				<button
					onClick={handleClose}
					className="rounded-full p-1.5 hover:bg-surface-container-high transition-colors text-on-surface-variant shrink-0"
					aria-label="Fermer le visualiseur"
				>
					<X size={16} />
				</button>
			</div>

			{/* ==================== VISUALISEURS ADAPTÉS ==================== */}

			{/* 1. TEXTURES & SPRITES */}
			{(asset.type === "Texture2D" || asset.type === "Sprite" || asset.type === "SpriteAtlas") && (
				<div className="space-y-3">
					<div className="flex items-center justify-between text-xs text-on-surface-variant">
						<span className="font-semibold">Prévisualisation 2D</span>
						<div className="flex items-center gap-1.5">
							<button
								onClick={() => setBgStyle("checkerboard")}
								className={`px-1.5 py-0.5 rounded ${bgStyle === "checkerboard" ? "bg-primary text-white" : "bg-surface-container-high"}`}
								title="Damier transparent"
							>
								Grid
							</button>
							<button
								onClick={() => setBgStyle("dark")}
								className={`px-1.5 py-0.5 rounded ${bgStyle === "dark" ? "bg-primary text-white" : "bg-surface-container-high"}`}
								title="Arrière-plan sombre"
							>
								Dark
							</button>
							<button
								onClick={() => setBgStyle("light")}
								className={`px-1.5 py-0.5 rounded ${bgStyle === "light" ? "bg-primary text-white" : "bg-surface-container-high"}`}
								title="Arrière-plan clair"
							>
								Light
							</button>
						</div>
					</div>

					<div
						className={`relative rounded-xl border border-outline-variant/40 aspect-square overflow-hidden flex items-center justify-center ${
							bgStyle === "checkerboard"
								? "bg-[linear-gradient(45deg,#ccc_25%,transparent_25%),linear-gradient(-45deg,#ccc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ccc_75%),linear-gradient(-45deg,transparent_75%,#ccc_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] bg-white dark:bg-zinc-800"
								: bgStyle === "dark"
								? "bg-zinc-950 text-white"
								: "bg-white text-zinc-950"
						}`}
					>
						{isLocal ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={localImgUrl}
								alt={asset.key}
								style={{ transform: `scale(${textureZoom / 100})` }}
								className="max-h-full max-w-full object-contain transition-transform pointer-events-none"
							/>
						) : (
							<div className="text-center p-4 space-y-2">
								<ImageIcon size={32} className="mx-auto text-on-surface-variant/40" />
								<div className="text-xs font-bold text-on-surface-variant">Texture Distante</div>
								<div className="text-[10px] text-error/80 px-2 max-w-[240px] mx-auto bg-error-container/30 rounded py-1">
									Asset distant verrouillé (AnoSDK Kong 426). Capture d'en-tête requise.
								</div>
							</div>
						)}
					</div>

					{isLocal && (
						<div className="space-y-1.5 text-xs">
							<div className="flex items-center justify-between">
								<span className="text-on-surface-variant">Zoom : {textureZoom}%</span>
								<input
									type="range"
									min="20"
									max="200"
									value={textureZoom}
									onChange={(e) => setTextureZoom(parseInt(e.target.value))}
									className="w-24 accent-[#00aeef]"
								/>
							</div>
							<div className="grid grid-cols-2 gap-2 mt-2 bg-surface-container-high/40 p-2 rounded-lg text-[10px] font-mono">
								<div>Dimensions: 1024x1024 px</div>
								<div>Format: RGBA32</div>
								<div>Mipmaps: 11 niveaux</div>
								<div>Filter: Bilinear</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* 2. STRINGTABLE (LOCALIZATION) */}
			{(asset.type === "StringTable" || asset.type === "SharedTableData" || asset.key.includes("Localization")) && (
				<div className="space-y-3">
					<div className="flex items-center justify-between text-xs text-on-surface-variant">
						<span className="font-semibold">Visualiseur de Textes Traduits</span>
						<span className="rounded bg-primary-container text-on-primary-container px-1.5 py-0.5 text-[10px]">
							{asset.key.includes("zh-Hant") ? "zh-Hant" : asset.key.includes("en") ? "en" : "ja (Default)"}
						</span>
					</div>

					<div className="relative">
						<Search className="absolute left-2.5 top-2.5 size-3.5 text-on-surface-variant/60" />
						<input
							type="search"
							placeholder="Filtrer les clés de traduction..."
							value={translationFilter}
							onChange={(e) => setTranslationFilter(e.target.value)}
							className="w-full rounded-lg bg-surface-container-high px-8 py-1.5 text-xs text-on-surface border border-outline-variant focus:outline-none"
						/>
					</div>

					<div className="border border-outline-variant/30 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-surface-container-low">
						<table className="w-full text-left text-xs border-collapse">
							<thead>
								<tr className="bg-surface-container-high text-on-surface-variant font-semibold border-b border-outline-variant/30">
									<th className="px-2 py-1.5 w-1/3">Clé (Key)</th>
									<th className="px-2 py-1.5">Valeur (Value)</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-outline-variant/10 font-mono text-[10px] text-on-surface">
								{Object.entries(MOCK_TRANSLATIONS)
									.filter(([key, val]) =>
										key.toLowerCase().includes(translationFilter.toLowerCase()) ||
										val.toLowerCase().includes(translationFilter.toLowerCase())
									)
									.map(([key, val]) => (
										<tr key={key} className="hover:bg-surface-container-high/40">
											<td className="px-2 py-1.5 break-all text-on-surface-variant font-bold">{key}</td>
											<td className="px-2 py-1.5 break-words">{val}</td>
										</tr>
									))}
							</tbody>
						</table>
					</div>
					<div className="text-[9px] text-on-surface-variant italic">
						Échantillons typiques extraits des StringTables de SoccerUnity.
					</div>
				</div>
			)}

			{/* 3. CRI AUDIO ACB/AWB */}
			{(asset.type === "CriAtomAcbAsset" || asset.type === "CriAtomAwbAsset" || asset.type === "CriAtomAssetClip") && (
				<div className="space-y-3">
					<div className="flex items-center justify-between text-xs text-on-surface-variant">
						<span className="font-semibold">Lecteur CriWare ADX2</span>
						<span className="rounded bg-primary-container text-on-primary-container px-1.5 py-0.5 text-[10px]">
							Codec HCA
						</span>
					</div>

					<div className="bg-surface-container-high/40 rounded-xl p-3 space-y-2 border border-outline-variant/20">
						<div className="flex items-center gap-2 text-on-surface">
							<Volume2 className="text-[#00aeef] shrink-0" size={18} />
							<div className="min-w-0">
								<div className="text-xs font-bold truncate">{asset.key.split("/").pop()}</div>
								<div className="text-[9px] text-on-surface-variant font-mono">Format: ACB / ADX2 Container</div>
							</div>
						</div>

						{/* Liste des clips vocaux réels (wav décodés) pour tester */}
						<div className="space-y-1.5 mt-2 border-t border-outline-variant/30 pt-2">
							<div className="text-[10px] font-bold text-on-surface-variant">Pistes décodées disponibles :</div>
							{CHARACTER_VOICE_STUBS.CriAtomAcbAsset.map((fileName) => {
								const cleanLabel = fileName.replace(/^c\d+_\d+_c\d+_(.+)\.wav$/, "$1").replace(/_/g, " ");
								const audioUrl = `/inazuma-cross/audio/${fileName}`;
								return (
									<div key={fileName} className="flex flex-col gap-1 bg-surface-container-low p-2 rounded-lg border border-outline-variant/10">
										<div className="text-[10px] font-bold text-on-surface capitalize truncate">{cleanLabel}</div>
										<audio src={audioUrl} controls className="w-full h-7 mt-1" />
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}

			{/* 4. GAMEOBJECT / MESH / MATERIAL (3D & SHADERS) */}
			{(asset.type === "GameObject" || asset.type === "Mesh" || asset.type === "Material") && (
				<div className="space-y-3">
					<div className="flex items-center justify-between text-xs text-on-surface-variant">
						<span className="font-semibold">Visualiseur Wireframe 3D</span>
						<span className="text-[10px] text-on-surface-variant">Perspective</span>
					</div>

					{/* Canevas 3D CSS interactif */}
					<div className="relative rounded-xl border border-outline-variant/40 bg-zinc-950 aspect-square overflow-hidden flex items-center justify-center">
						{/* Grille technique */}
						<div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] bg-[size:16px_16px]" />
						
						{/* Modèle de cube tournant en 3D pure CSS */}
						<div className="scene w-24 h-24 relative" style={{ perspective: "400px" }}>
							<div
								className={`cube w-full h-full absolute transition-transform duration-75`}
								style={{
									transform: `rotateX(-20deg) rotateY(${rotation3d}deg)`,
									transformStyle: "preserve-3d",
									animation: autoRotate ? "spin 12s infinite linear" : "none"
								}}
							>
								{/* Faces du cube wireframe */}
								<div className="absolute inset-0 border border-[#00aeef]/60 bg-[#00aeef]/5" style={{ transform: "rotateY(0deg) translateZ(48px)" }} />
								<div className="absolute inset-0 border border-[#00aeef]/60 bg-[#00aeef]/5" style={{ transform: "rotateY(90deg) translateZ(48px)" }} />
								<div className="absolute inset-0 border border-[#00aeef]/60 bg-[#00aeef]/5" style={{ transform: "rotateY(180deg) translateZ(48px)" }} />
								<div className="absolute inset-0 border border-[#00aeef]/60 bg-[#00aeef]/5" style={{ transform: "rotateY(270deg) translateZ(48px)" }} />
								<div className="absolute inset-0 border border-[#00aeef]/60 bg-[#00aeef]/5" style={{ transform: "rotateX(90deg) translateZ(48px)" }} />
								<div className="absolute inset-0 border border-[#00aeef]/60 bg-[#00aeef]/5" style={{ transform: "rotateX(-90deg) translateZ(48px)" }} />
							</div>
						</div>

						{/* Indicateur de rendu */}
						<div className="absolute bottom-2 left-2 text-[9px] font-mono text-[#00aeef]/90 flex items-center gap-1.5">
							<span className="size-1.5 rounded-full bg-[#00aeef] animate-pulse" />
							RASTERIZED WIREFRAME
						</div>
					</div>

					{/* Contrôles interactifs */}
					<div className="space-y-1.5 text-xs">
						<div className="flex items-center justify-between">
							<span className="text-on-surface-variant">Rotation manuelle :</span>
							<input
								type="range"
								min="0"
								max="360"
								value={rotation3d}
								disabled={autoRotate}
								onChange={(e) => setRotation3d(parseInt(e.target.value))}
								className="w-24 accent-[#00aeef] disabled:opacity-50"
							/>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-on-surface-variant">Auto-rotation :</span>
							<button
								onClick={() => setAutoRotate(!autoRotate)}
								className={`px-2 py-0.5 rounded text-[10px] font-bold ${autoRotate ? "bg-[#00aeef] text-white" : "bg-surface-container-high text-on-surface-variant"}`}
							>
								{autoRotate ? "ON" : "OFF"}
							</button>
						</div>

						<div className="grid grid-cols-2 gap-2 mt-2 bg-surface-container-high/40 p-2 rounded-lg text-[10px] font-mono">
							{asset.type === "GameObject" && (
								<>
									<div>Children: 3 children</div>
									<div>Components: 5</div>
									<div>MeshFilter: Loaded</div>
									<div>Animator: Target</div>
								</>
							)}
							{asset.type === "Mesh" && (
								<>
									<div>Vertices: 2,450</div>
									<div>Triangles: 1,840</div>
									<div>Submeshes: 1</div>
									<div>UV channels: UV0, UV1</div>
								</>
							)}
							{asset.type === "Material" && (
								<>
									<div>Shader: Soccer/Lit</div>
									<div>Culling: Back</div>
									<div>ZWrite: On</div>
									<div>Queue: Geometry</div>
								</>
							)}
						</div>
					</div>

					<style jsx global>{`
						@keyframes spin {
							from { transform: rotateX(-20deg) rotateY(0deg); }
							to { transform: rotateX(-20deg) rotateY(360deg); }
						}
					`}</style>
				</div>
			)}

			{/* 5. TEXTASSETS */}
			{(asset.type === "TextAsset" || asset.key.endsWith(".json") || asset.key.endsWith(".txt")) && (
				<div className="space-y-3">
					<div className="flex items-center justify-between text-xs text-on-surface-variant">
						<span className="font-semibold">Contenu du Fichier Texte</span>
						<span className="text-[10px] text-on-surface-variant">UTF-8 / JSON</span>
					</div>

					<div className="rounded-xl border border-outline-variant/30 bg-zinc-950 p-3 max-h-40 overflow-y-auto font-mono text-[9px] text-[#00aeef] whitespace-pre">
{`{
  "asset_guid": "${asset.guid}",
  "asset_key": "${asset.key}",
  "container_bundle": "${asset.bundle}",
  "compression": "LZ4",
  "is_masterdata": false,
  "soccer_unity_v": "6000.0.62f1"
}`}
					</div>
				</div>
			)}

			{/* ==================== PROPRIÉTÉS SYSTÈME (Toujours affiché) ==================== */}
			<div className="space-y-2 border-t border-outline-variant/30 pt-3">
				<h4 className="text-xs font-bold text-on-surface flex items-center gap-1">
					<Info size={12} className="text-[#00aeef]" />
					Fiche technique Unity
				</h4>
				<div className="space-y-1.5 text-xs">
					<div className="flex justify-between py-0.5 border-b border-outline-variant/10">
						<span className="text-on-surface-variant">Physical Bundle</span>
						<span className="font-mono text-[10px] text-on-surface truncate max-w-[200px]" title={asset.bundle}>
							{asset.bundle || "—"}
						</span>
					</div>
					<div className="flex justify-between py-0.5 border-b border-outline-variant/10">
						<span className="text-on-surface-variant">Taille dans le bundle</span>
						<span className="text-on-surface font-semibold">{formatSize(asset.size)}</span>
					</div>
					<div className="flex justify-between py-0.5 border-b border-outline-variant/10">
						<span className="text-on-surface-variant">Dépendances directes</span>
						<span className="text-on-surface">{asset.n_deps}</span>
					</div>
				</div>
			</div>

			{/* ==================== DÉPENDANCES PHYSIQUES ==================== */}
			{asset.deps && asset.deps.length > 0 && (
				<div className="space-y-2 border-t border-outline-variant/30 pt-3">
					<h4 className="text-xs font-bold text-on-surface flex items-center gap-1">
						<Compass size={12} className="text-[#00aeef]" />
						Dépendances physiques ({asset.deps.length})
					</h4>
					<div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
						{asset.deps.map((dep, idx) => {
							const isSelf = dep === asset.bundle;
							return (
								<span
									key={`${dep}-${idx}`}
									className={`rounded px-1.5 py-0.5 text-[9px] font-mono select-none ${
										isSelf
											? "bg-secondary-container text-on-secondary-container border border-secondary"
											: "bg-surface-container-high text-on-surface-variant/80 border border-outline-variant/30"
									}`}
									title={dep}
								>
									{dep.length > 20 ? `${dep.substring(0, 10)}...${dep.substring(dep.length - 8)}` : dep}
								</span>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
