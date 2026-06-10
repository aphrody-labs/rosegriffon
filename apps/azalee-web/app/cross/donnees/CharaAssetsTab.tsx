import React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { classifyCharacterAssets } from "@rose-griffon/inagle-cross";
import { resolveCrossAssetUrl } from "@/lib/cross/assets-shared";
import { CROSS_CYAN } from "@/lib/cross/data-shared";

interface CharaAssetsTabProps {
	charaInputs: Record<string, any>;
	characterNames: Record<string, string>;
	selectedChar: string;
	dev: boolean;
	q: string;
}

export function CharaAssetsTab({
	charaInputs,
	characterNames,
	selectedChar,
	dev,
	q,
}: CharaAssetsTabProps) {
	const input = charaInputs[selectedChar];
	if (!input) return null;
	const links = classifyCharacterAssets(input);

	const renderAssetRow = (label: string, key: string | null, asset: any) => {
		if (!key) return null;
		const url = resolveCrossAssetUrl(key);
		return (
			<div key={label + key} className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 hover:border-outline-variant transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="space-y-1">
					<div className="text-xs font-bold text-on-surface-variant/80 uppercase">{label}</div>
					<div className="text-sm font-mono text-on-surface break-all">{key}</div>
					{dev && asset && (
						<div className="text-[10px] text-on-surface-variant/70 space-y-0.5 mt-1">
							<div>GUID : <span className="font-mono">{asset.guid}</span></div>
							<div>Bundle : <span className="font-mono text-[#00aeef]">{asset.bundle}</span></div>
							<div>Taille : <span>{(asset.size / 1024).toFixed(1)} Ko</span></div>
						</div>
					)}
				</div>
				<div className="shrink-0 flex items-center gap-2">
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-full bg-surface-container-high hover:bg-surface-container-highest px-3 py-1.5 text-xs font-bold text-on-surface border border-outline-variant/50 transition-colors flex items-center gap-1"
					>
						<ExternalLink size={12} />
						Ouvrir
					</a>
				</div>
			</div>
		);
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
			{/* Sélecteur de personnage */}
			<div className="space-y-3">
				<h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant/70">
					Personnages Rétro-conçus
				</h3>
				<div className="flex flex-col gap-2">
					{Object.keys(charaInputs).map((charId) => {
						const active = selectedChar === charId;
						const name = characterNames[charId] || charId;
						return (
							<Link
								key={charId}
								href={`/cross/donnees?tab=chara_assets&char=${charId}${q ? `&q=${q}` : ""}${dev ? "&dev=true" : ""}`}
								className={`flex items-center justify-between rounded-xl px-4 py-3 border text-sm font-semibold transition-all ${
									active
										? "bg-[#00aeef] text-white border-[#00aeef] shadow-sm"
										: "bg-surface-container hover:bg-surface-container-high border-outline-variant/30 text-on-surface"
								}`}
							>
								<span>{name}</span>
								<span className={`text-xs rounded-full px-2 py-0.5 ${active ? "bg-white/25 text-white" : "bg-surface-container-highest text-on-surface-variant"}`}>
									{charId}
								</span>
							</Link>
						);
					})}
				</div>

				<div className="rounded-2xl bg-surface-container-low border border-outline-variant/30 p-4 space-y-2">
					<h4 className="text-xs font-bold uppercase text-on-surface">Liaison d'Assets</h4>
					<p className="text-xs text-on-surface-variant leading-relaxed">
						Le package <code className="font-mono text-[#00aeef]">@rose-griffon/inagle-cross</code> résout de manière type-safe les clés logiques Unity Addressables et les associe aux fichiers du catalogue d'assets extraits de l'APK.
					</p>
				</div>
			</div>

			{/* Détail des assets liés */}
			<div className="space-y-6">
				<div className="space-y-6">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-outline-variant/30">
						<div>
							<h2 className="text-xl font-black text-on-surface">
								{characterNames[selectedChar] || selectedChar}
							</h2>
							<p className="text-xs text-on-surface-variant mt-1">
								Code d'identification : <span className="font-mono">{links.code}</span>
							</p>
						</div>
					</div>

					{/* 1. Profil & Visuels */}
					<div className="space-y-3">
						<h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
							1. Identité Visuelle & Visage
						</h3>
						<div className="grid grid-cols-1 gap-3">
							{renderAssetRow("Portrait / Icône", links.icon, links.iconAsset)}
							{renderAssetRow("Modèle de Visage en Jeu (Face Rig)", links.faceInGame, links.faceInGameAsset)}
							{renderAssetRow("Modèle de Visage Cinématiques (Director)", links.faceDirector, links.faceDirectorAsset)}
						</div>
					</div>

					{/* 2. Audio & Voix */}
					<div className="space-y-3">
						<h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
							2. Fichiers de Voix
						</h3>
						<div className="grid grid-cols-1 gap-3">
							{renderAssetRow("Cuesheet Audio (ACB)", links.voiceAcb, links.voiceAcbAsset)}
							{renderAssetRow("Streaming Audio (AWB)", links.voiceAwb, links.voiceAwbAsset)}
						</div>

						{links.voiceWavs.length > 0 && (
							<div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-4 space-y-3">
								<div className="flex items-center justify-between">
									<div className="text-xs font-bold text-on-surface-variant uppercase">
										Clips Voix WAV Décodés ({links.voiceWavs.length})
									</div>
								</div>
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
									{links.voiceWavs.slice(0, 24).map((wav) => (
										<div
											key={wav.fileName}
											className="p-2 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-2 text-xs"
										>
											<span className="font-bold text-on-surface truncate capitalize">{wav.cueName.replace(/_/g, " ")}</span>
											<audio src={`/inazuma-cross/audio/${wav.fileName}`} controls className="h-6 w-32 shrink-0 scale-90 origin-right" />
										</div>
									))}
								</div>
								{links.voiceWavs.length > 24 && (
									<p className="text-[10px] text-on-surface-variant/80 text-center italic">
										Affichage des 24 premiers clips. Retrouvez l'intégralité dans l'onglet Voix & Audios.
									</p>
								)}
							</div>
						)}
					</div>

					{/* 3. Géométrie du Corps & Tenues */}
					<div className="space-y-3">
						<h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
							3. Modèle 3D, Squelette & Équipements
						</h3>
						<div className="grid grid-cols-1 gap-3">
							{renderAssetRow("Squelette de Base / Fbx", links.bodyMesh, links.bodyMeshAsset)}
							{renderAssetRow("Texture de Peau / Skin", links.skin, links.skinAsset)}
							{renderAssetRow("Chaussures de Sport / Shoes", links.shoes, links.shoesAsset)}
							{renderAssetRow("Gants de Gardien / Glove", links.glove, links.gloveAsset)}
							{renderAssetRow("Brassard de Capitaine / Captain Armband", links.captainMark, links.captainMarkAsset)}
							{renderAssetRow("Numéro de Maillot / Jersey Number", links.uniformNumber, links.uniformNumberAsset)}
							{renderAssetRow("Correction de Silhouette", links.shapeCorrection, links.shapeCorrectionAsset)}
						</div>
					</div>

					{/* 4. Uniformes */}
					{links.uniforms.length > 0 && (
						<div className="space-y-3">
							<h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
								4. Uniformes & Maillots (Home / Away)
							</h3>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								{links.uniforms.map((uni) => (
									<div
										key={`${uni.variant}-${uni.isHome}`}
										className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 hover:border-outline-variant transition-all space-y-3"
									>
										<div className="flex items-center justify-between">
											<span className="text-xs font-black uppercase" style={{ color: CROSS_CYAN }}>
												Maillot {uni.isHome ? "Domicile" : "Extérieur"}
											</span>
											<span className="text-[10px] font-mono text-on-surface-variant">{uni.variant}</span>
										</div>
										<div className="space-y-1 text-xs">
											<div className="text-on-surface-variant">Maillage 3D :</div>
											<div className="font-mono text-on-surface truncate" title={uni.mesh || ""}>{uni.mesh || "—"}</div>
											<div className="text-on-surface-variant mt-2">Matériau / Texture :</div>
											<div className="font-mono text-on-surface truncate" title={uni.material || ""}>{uni.material || "—"}</div>
										</div>
										{dev && uni.materialAsset && (
											<div className="text-[9px] text-on-surface-variant/70 border-t border-outline-variant/20 pt-2 space-y-0.5">
												<div>GUID : <span className="font-mono">{uni.materialAsset.guid}</span></div>
												<div>Bundle : <span className="font-mono truncate block">{uni.materialAsset.bundle}</span></div>
											</div>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* 5. Motions / Animations */}
					{links.motions.length > 0 && (
						<div className="space-y-3">
							<h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
								5. Animations & Mouvements ({links.motions.length})
							</h3>
							<div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-4">
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
									{links.motions.map((mot) => (
										<div
											key={mot.key}
											className="p-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-[11px] space-y-1"
										>
											<div className="font-bold text-on-surface truncate" title={mot.key}>
												{mot.key.split("/").pop()}
											</div>
											{dev && (
												<div className="text-[9px] text-on-surface-variant/70">
													Bundle: <span className="font-mono">{mot.asset.bundle.slice(0, 12)}...</span>
												</div>
											)}
										</div>
									))}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
