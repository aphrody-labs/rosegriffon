/* eslint-disable import/no-default-export, import/no-named-export, import/max-dependencies, react/jsx-max-depth, import/exports-last, import/group-exports */
import React from "react";
import { 
	Database, KeyRound, Lock, Music, Table2, Layers 
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CROSS_CYAN } from "@/lib/cross/data-shared";
import {
	getCrossCatalogStats,
	getCrossDataCounts,
	getCrossEnums,
	getCrossStatus,
	getCrossTables,
} from "@/lib/cross/data";
import { searchCatalog, getCatalogTypes, getAssetByGuid as getAsset } from "@rose-griffon/inagle-cross";
import audioJson from "@/data/cross/audio-manifest.json";

import { TablesTab } from "./TablesTab";
import { EnumsTab } from "./EnumsTab";
import { AssetsTab } from "./AssetsTab";
import { AudioTab } from "./AudioTab";
import { CharaAssetsTab } from "./CharaAssetsTab";
import { LeaksTab } from "./LeaksTab";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	alternates: { canonical: "/cross/donnees" },
	description:
		"Modèle de données d'Inazuma Eleven Cross extrait par rétro-ingénierie statique du jeu (Unity IL2CPP) : 153 tables masterdata typées, 214 énumérations, catalogue d'assets, voix décodées. Les valeurs de jeu restent côté serveur.",
	title: "Données extraites | Inazuma Eleven Cross - Azalée",
};

const CHARACTER_NAMES: Record<string, string> = {
	c00001001: "Yo Shiosawa (Protagoniste)",
	c00003001: "Mark Evans (Mamoru Endou)",
	c00003021: "Jude Sharp (Yuuto Kidou)",
};

const CHARA_INPUTS: Record<string, any> = {
	c00001001: {
		code: "c00001001",
		characterIconCode: 1001,
		faceCode: 1000010,
		voiceCode: 1001,
		shape: 1,
		defaultModelSet: {
			uniformCode: 1,
			skinCode: 101,
			gloveCode: 101,
			shoesCode: 101,
			uniformNumberCode: 101,
			captainMarkCode: 101
		}
	},
	c00003001: {
		code: "c00003001",
		characterIconCode: 3001,
		faceCode: 3030010,
		voiceCode: 3001,
		shape: 5,
		defaultModelSet: {
			uniformCode: 2,
			skinCode: 201,
			shoesCode: 201
		}
	},
	c00003021: {
		code: "c00003021",
		characterIconCode: 3021,
		faceCode: 3032210,
		voiceCode: 3021,
		shape: 1,
		defaultModelSet: {
			uniformCode: 2,
			skinCode: 101,
			shoesCode: 201
		}
	}
};

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
	return (
		<div className="rounded-2xl bg-surface-container px-4 py-3 border border-outline-variant/50">
			<div className="flex items-center gap-2 text-on-surface-variant">{icon}</div>
			<div className="text-2xl font-black text-on-surface mt-1">{value}</div>
			<div className="text-xs text-on-surface-variant">{label}</div>
		</div>
	);
}

export default async function CrossDataPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const sp = await searchParams;
	const q = typeof sp.q === "string" ? sp.q : "";
	const dev = sp.dev === "true";
	let tab = typeof sp.tab === "string" ? sp.tab : "tables";

	if (!dev && (tab === "enums" || tab === "assets")) {
		tab = "tables";
	}
	const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page) || 1) : 1;
	const assetType = typeof sp.type === "string" ? sp.type : "";
	const selectedChar = typeof sp.char === "string" && (audioJson.characters as any)[sp.char] ? sp.char : "c00001001";
	
	const selectedAssetGuid = typeof sp.asset === "string" ? sp.asset : "";
	const selectedAsset = selectedAssetGuid ? getAsset(selectedAssetGuid) : null;

	const status = getCrossStatus();
	const counts = getCrossDataCounts();
	const tables = getCrossTables(q);
	const enums = getCrossEnums(q);
	const stats = getCrossCatalogStats();
	const totals = (stats.totals ?? {}) as Record<string, number>;
	const catalogObjects = totals.loadable_objects ?? totals.rows ?? 0;

	// Charger les assets du catalogue
	const limit = 55;
	const offset = (page - 1) * limit;
	const { assets, total: totalAssets } = searchCatalog(q, assetType, limit, offset);
	const assetTypes = getCatalogTypes();
	const totalPages = Math.ceil(totalAssets / limit);

	// Charger les voix audio
	const characterLines: string[] = ((audioJson.characters as any)[selectedChar] || []).filter((line: string) => /^\d+/.test(line));
	const filteredLines = q
		? characterLines.filter((line) => line.toLowerCase().includes(q.toLowerCase()))
		: characterLines;

	let searchPlaceholder = "Filtrer tables et énumérations…";
	if (tab === "assets") {
		searchPlaceholder = "Rechercher par adresse (key) ou nom de bundle…";
	} else if (tab === "audio") {
		searchPlaceholder = "Rechercher par action de clip audio…";
	} else if (tab === "chara_assets") {
		searchPlaceholder = "Rechercher par mot-clé…";
	} else if (tab === "leaks") {
		searchPlaceholder = "Rechercher une mécanique ou mot-clé…";
	}

	const lockIcon = (
		<span className="text-error shrink-0 mt-0.5">
			<Lock size={18} />
		</span>
	);

	return (
		<div className="w-full space-y-8">
			{/* Hero */}
			<div
				className="rounded-3xl p-5 sm:p-7 border-2"
				style={{
					borderColor: CROSS_CYAN,
					background: `linear-gradient(135deg, ${CROSS_CYAN}1a, transparent 70%)`,
				}}
			>
				<p className="text-xs font-bold uppercase tracking-wider" style={{ color: CROSS_CYAN }}>
					Inazuma Eleven Cross · {status.engine}
				</p>
				<h1 className="text-2xl lg:text-3xl font-black text-on-surface tracking-tight mt-1">
					Données extraites
				</h1>
				<p className="text-sm text-on-surface-variant mt-2 max-w-2xl">
					Modèle de données reconstitué par rétro-ingénierie statique du jeu (jeu mobile distinct de
					Victory Road). Schéma, types, énumérations, catalogue d'assets et voix audio sont réels ; les <strong>valeurs</strong> de jeu
					(stats des joueurs, hissatsu…) sont servies par le serveur du jeu et ne sont pas encore
					récupérées.
				</p>
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5">
					<StatTile icon={<Table2 size={16} />} value={String(counts.tables)} label="tables masterdata" />
					<StatTile icon={<Database size={16} />} value={String(counts.columns)} label="colonnes typées" />
					<StatTile icon={<KeyRound size={16} />} value={String(counts.enums)} label="énumérations" />
					<StatTile
						icon={<Layers size={16} />}
						value={catalogObjects ? catalogObjects.toLocaleString("fr-FR") : "—"}
						label="objets catalogue"
					/>
					<StatTile icon={<Music size={16} />} value={String(status.audio_wav)} label="voix décodées" />
				</div>
			</div>

			{/* Blocage honnête */}
			<div className="rounded-2xl bg-error-container/40 border border-error/30 p-4 flex gap-3">
				{lockIcon}
				<p className="text-sm text-on-surface-variant">
					<span className="font-semibold text-on-surface">Limites de l'extraction statique.</span> Les images (textures, sprites), modèles 3D (GameObjects, Meshes) et vidéos de gameplay internes font partie des 1 481 bundles distants hébergés sur le CDN de Level-5. Ce CDN et l'API de jeu sont protégés par l'anti-triche <strong>NEXON AnoSDK / Kong</strong> qui renvoie une erreur HTTP 426 sans en-tête de session dynamique. Seules les ressources locales (13 bundles de base, 24 atlas d'UI et 305 voix audio décodées) sont visualisables en clair pour le moment. Localisation du jeu : {status.localization_langs.join(" / ")}.
				</p>
			</div>

			{/* Onglets de Navigation */}
			<div className="flex border-b border-outline-variant/30 gap-6 text-sm font-bold overflow-x-auto whitespace-nowrap">
				<Link
					href={`/cross/donnees?tab=tables${q ? `&q=${q}` : ""}${dev ? "&dev=true" : ""}`}
					className={`pb-3 border-b-2 transition-colors ${
						tab === "tables"
							? "text-[#00aeef] border-[#00aeef]"
							: "text-on-surface-variant/70 border-transparent hover:text-on-surface"
					}`}
				>
					{dev ? `Tables Masterdata (${counts.tables})` : "Encyclopédie & Systèmes"}
				</Link>
				<Link
					href={`/cross/donnees?tab=leaks${q ? `&q=${q}` : ""}${dev ? "&dev=true" : ""}`}
					className={`pb-3 border-b-2 transition-colors ${
						tab === "leaks"
							? "text-[#00aeef] border-[#00aeef]"
							: "text-on-surface-variant/70 border-transparent hover:text-on-surface"
					}`}
				>
					⚡ Révélations & Leaks
				</Link>
				{dev && (
					<>
						<Link
							href={`/cross/donnees?tab=enums${q ? `&q=${q}` : ""}&dev=true`}
							className={`pb-3 border-b-2 transition-colors ${
								tab === "enums"
									? "text-[#00aeef] border-[#00aeef]"
									: "text-on-surface-variant/70 border-transparent hover:text-on-surface"
							}`}
						>
							Énumérations ({counts.enums})
						</Link>
						<Link
							href={`/cross/donnees?tab=assets${q ? `&q=${q}` : ""}&dev=true`}
							className={`pb-3 border-b-2 transition-colors ${
								tab === "assets"
									? "text-[#00aeef] border-[#00aeef]"
									: "text-on-surface-variant/70 border-transparent hover:text-on-surface"
							}`}
						>
							Catalogue d'Assets ({catalogObjects.toLocaleString("fr-FR")})
						</Link>
					</>
				)}
				<Link
					href={`/cross/donnees?tab=audio${q ? `&q=${q}` : ""}${dev ? "&dev=true" : ""}`}
					className={`pb-3 border-b-2 transition-colors ${
						tab === "audio"
							? "text-[#00aeef] border-[#00aeef]"
							: "text-on-surface-variant/70 border-transparent hover:text-on-surface"
					}`}
				>
					Voix & Audios ({audioJson.total_wav})
				</Link>
				<Link
					href={`/cross/donnees?tab=chara_assets${q ? `&q=${q}` : ""}${dev ? "&dev=true" : ""}`}
					className={`pb-3 border-b-2 transition-colors ${
						tab === "chara_assets"
							? "text-[#00aeef] border-[#00aeef]"
							: "text-on-surface-variant/70 border-transparent hover:text-on-surface"
					}`}
				>
					Personnages & Assets
				</Link>
			</div>

			{/* Recherche */}
			<form className="flex flex-col sm:flex-row gap-2" action="/cross/donnees">
				<input type="hidden" name="tab" value={tab} />
				{dev && <input type="hidden" name="dev" value="true" />}
				{tab === "audio" && <input type="hidden" name="char" value={selectedChar} />}
				<input
					type="search"
					name="q"
					defaultValue={q}
					placeholder={searchPlaceholder}
					className="flex-1 rounded-full bg-surface-container px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-2"
					style={{ outlineColor: CROSS_CYAN }}
				/>
				{tab === "assets" && (
					<select
						name="type"
						defaultValue={assetType}
						className="rounded-full bg-surface-container px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-2"
						style={{ outlineColor: CROSS_CYAN }}
					>
						<option value="">Tous les types ({assetTypes.length})</option>
						{assetTypes.map((t) => (
							<option key={t} value={t}>
								{t}
							</option>
						))}
					</select>
				)}
				<button
					type="submit"
					className="rounded-full px-6 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
					style={{ backgroundColor: CROSS_CYAN }}
				>
					Rechercher
				</button>
			</form>

			{/* Contenu des Onglets */}
			{tab === "tables" && (
				<TablesTab tables={tables} dev={dev} q={q} />
			)}

			{tab === "enums" && (
				<EnumsTab enums={enums} />
			)}

			{tab === "assets" && (
				<AssetsTab
					assets={assets}
					totalAssets={totalAssets}
					selectedAssetGuid={selectedAssetGuid}
					selectedAsset={selectedAsset}
					page={page}
					q={q}
					assetType={assetType}
					totalPages={totalPages}
				/>
			)}

			{tab === "audio" && (
				<AudioTab
					audioJson={audioJson}
					characterNames={CHARACTER_NAMES}
					selectedChar={selectedChar}
					filteredLines={filteredLines}
					q={q}
					dev={dev}
				/>
			)}

			{tab === "chara_assets" && (
				<CharaAssetsTab
					charaInputs={CHARA_INPUTS}
					characterNames={CHARACTER_NAMES}
					selectedChar={selectedChar}
					dev={dev}
					q={q}
				/>
			)}

			{tab === "leaks" && (
				<LeaksTab dev={dev} />
			)}

			{/* Bannière Mode Développeur / Encyclopédie publique */}
			<div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
				<div className="space-y-1 text-center sm:text-left">
					<h4 className="font-bold text-sm text-on-surface">
						{dev ? "Mode Développeur Actif" : "Mode d'exploration publique"}
					</h4>
					<p className="text-xs text-on-surface-variant max-w-xl">
						{dev 
							? "Les structures de code C# décompilées, le catalogue d'assets binaires et les énumérations techniques du jeu sont affichés pour les développeurs et reverse-engineers." 
							: "Vous explorez actuellement la version humanisée de l'Encyclopédie de jeu. Les codes sources, fichiers bruts de données de jeu et énumérations techniques sont masqués."}
					</p>
				</div>
				<Link 
					href={dev 
						? `/cross/donnees?tab=${tab}${q ? `&q=${q}` : ""}` 
						: `/cross/donnees?tab=${tab}&dev=true${q ? `&q=${q}` : ""}`}
					className="rounded-full bg-surface-container-high hover:bg-surface-container-highest px-4 py-2 text-xs font-bold text-on-surface border border-outline-variant/50 cursor-pointer text-center whitespace-nowrap shrink-0 transition-colors"
				>
					{dev ? "Désactiver le mode Développeur" : "Activer le mode Développeur"}
				</Link>
			</div>
		</div>
	);
}
