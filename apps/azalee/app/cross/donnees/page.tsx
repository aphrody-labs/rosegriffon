export const dynamic = "force-dynamic";

import { ArrowRight, Database, KeyRound, Lock, Music, Table2, Layers, Search, FileArchive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FadeInItem, FadeInStagger } from "@/components/ui/fade-in";
import { CROSS_CYAN } from "@/lib/cross/data-shared";
import {
	getCrossCatalogStats,
	getCrossDataCounts,
	getCrossEnums,
	getCrossStatus,
	getCrossTables,
} from "@/lib/cross/data";
import { searchCatalog, getCatalogTypes, getAsset } from "@/lib/cross/catalog";
import AssetVisualizer from "./AssetVisualizer";
import audioJson from "@/data/cross/audio-manifest.json";

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
	const tab = typeof sp.tab === "string" ? sp.tab : "tables";
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
	const characterLines: string[] = (audioJson.characters as any)[selectedChar] || [];
	const filteredLines = q
		? characterLines.filter((line) => line.toLowerCase().includes(q.toLowerCase()))
		: characterLines;

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
				<Lock size={18} className="text-error shrink-0 mt-0.5" />
				<p className="text-sm text-on-surface-variant">
					<span className="font-semibold text-on-surface">Valeurs en attente.</span> Les lignes de
					données (stats chiffrées) transitent par le serveur du jeu protégé par anti-triche — leur
					récupération nécessite une capture runtime. Cette page ne montre donc que le{" "}
					<strong>modèle</strong>, le <strong>catalogue</strong> et les **voix décodées**, jamais de valeur inventée. Localisation du jeu : {status.localization_langs.join(" / ")}.
				</p>
			</div>

			{/* Onglets de Navigation */}
			<div className="flex border-b border-outline-variant/30 gap-6 text-sm font-bold overflow-x-auto whitespace-nowrap">
				<Link
					href={`/cross/donnees?tab=tables${q ? `&q=${q}` : ""}`}
					className={`pb-3 border-b-2 transition-colors ${
						tab === "tables"
							? "text-[#00aeef] border-[#00aeef]"
							: "text-on-surface-variant/70 border-transparent hover:text-on-surface"
					}`}
				>
					Tables Masterdata ({counts.tables})
				</Link>
				<Link
					href={`/cross/donnees?tab=enums${q ? `&q=${q}` : ""}`}
					className={`pb-3 border-b-2 transition-colors ${
						tab === "enums"
							? "text-[#00aeef] border-[#00aeef]"
							: "text-on-surface-variant/70 border-transparent hover:text-on-surface"
					}`}
				>
					Énumérations ({counts.enums})
				</Link>
				<Link
					href={`/cross/donnees?tab=assets${q ? `&q=${q}` : ""}`}
					className={`pb-3 border-b-2 transition-colors ${
						tab === "assets"
							? "text-[#00aeef] border-[#00aeef]"
							: "text-on-surface-variant/70 border-transparent hover:text-on-surface"
					}`}
				>
					Catalogue d'Assets ({catalogObjects.toLocaleString("fr-FR")})
				</Link>
				<Link
					href={`/cross/donnees?tab=audio${q ? `&q=${q}` : ""}`}
					className={`pb-3 border-b-2 transition-colors ${
						tab === "audio"
							? "text-[#00aeef] border-[#00aeef]"
							: "text-on-surface-variant/70 border-transparent hover:text-on-surface"
					}`}
				>
					Voix & Audios ({audioJson.total_wav})
				</Link>
			</div>

			{/* Recherche */}
			<form className="flex flex-col sm:flex-row gap-2" action="/cross/donnees">
				<input type="hidden" name="tab" value={tab} />
				{tab === "audio" && <input type="hidden" name="char" value={selectedChar} />}
				<input
					type="search"
					name="q"
					defaultValue={q}
					placeholder={
						tab === "assets"
							? "Rechercher par adresse (key) ou nom de bundle…"
							: tab === "audio"
							? "Rechercher par action de clip audio…"
							: "Filtrer tables et énumérations…"
					}
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

			{/* Tables masterdata */}
			{tab === "tables" && (
				<section>
					<h2 className="text-lg font-black text-on-surface mb-3">
						Tables masterdata <span className="text-on-surface-variant font-normal">({tables.length})</span>
					</h2>
					<FadeInStagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{tables.map((t) => (
							<FadeInItem key={t.slug}>
								<Link
									href={`/cross/donnees/${encodeURIComponent(t.slug)}`}
									className="group block rounded-2xl bg-surface-container hover:bg-surface-container-high transition-colors p-4 border border-outline-variant/50 h-full"
								>
									<div className="flex items-start justify-between gap-2">
										<span className="font-bold text-on-surface text-sm leading-tight">{t.short}</span>
										<ArrowRight
											size={16}
											className="text-on-surface-variant group-hover:translate-x-0.5 transition-transform shrink-0"
										/>
									</div>
									<p className="text-xs text-on-surface-variant mt-1 truncate" title={t.file}>
										{t.file}
									</p>
									<div className="flex flex-wrap gap-1.5 mt-3 text-[11px]">
										<span className="rounded-full bg-primary-container text-on-primary-container px-2 py-0.5">
											{t.columnCount} colonnes
										</span>
										{t.refCount > 0 && (
											<span className="rounded-full bg-surface-container-highest text-on-surface px-2 py-0.5">
												{t.refCount} réf.
											</span>
										)}
										{t.enumCount > 0 && (
											<span className="rounded-full bg-tertiary-container text-on-tertiary-container px-2 py-0.5">
												{t.enumCount} enum
											</span>
										)}
										{t.extends && (
											<span className="rounded-full bg-secondary-container text-on-secondary-container px-2 py-0.5">
												: {t.extends.split(".").pop()}
											</span>
										)}
									</div>
								</Link>
							</FadeInItem>
						))}
					</FadeInStagger>
				</section>
			)}

			{/* Enums */}
			{tab === "enums" && (
				<section>
					<h2 className="text-lg font-black text-on-surface mb-3">
						Énumérations <span className="text-on-surface-variant font-normal">({enums.length})</span>
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{enums.slice(0, 60).map((e) => (
							<div key={e.name} className="rounded-2xl bg-surface-container p-4 border border-outline-variant/50">
								<div className="font-bold text-on-surface text-sm">{e.short}</div>
								<div className="flex flex-wrap gap-1.5 mt-2">
									{e.members.slice(0, 24).map((m) => (
										<span
											key={`${e.name}.${m.name}`}
											className="rounded-md bg-surface-container-highest text-on-surface-variant px-1.5 py-0.5 text-[11px]"
											title={`= ${m.value}`}
										>
											{m.name}
										</span>
									))}
									{e.members.length > 24 && (
										<span className="text-[11px] text-on-surface-variant">+{e.members.length - 24}</span>
									)}
								</div>
							</div>
						))}
					</div>
					{enums.length > 60 && (
						<p className="text-xs text-on-surface-variant mt-3">
							{enums.length - 60} énumérations supplémentaires (affinez la recherche).
						</p>
					)}
				</section>
			)}

			{/* Catalogue d'Assets */}
			{tab === "assets" && (
				<section className="space-y-4">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-black text-on-surface">
							Objets du catalogue Addressables
							<span className="text-on-surface-variant font-normal ml-2">
								({totalAssets.toLocaleString("fr-FR")} trouvés)
							</span>
						</h2>
					</div>
					
					{assets.length === 0 ? (
						<div className="rounded-2xl bg-surface-container p-8 text-center border border-outline-variant/30 text-on-surface-variant">
							Aucun asset ne correspond à votre recherche.
						</div>
					) : (
						<div className={`grid grid-cols-1 ${selectedAsset ? "lg:grid-cols-[1fr_400px]" : ""} gap-6 items-start`}>
							<div className="space-y-4">
								<div className="overflow-x-auto rounded-2xl border border-outline-variant/50 bg-surface-container-low">
									<table className="w-full text-left border-collapse text-sm">
										<thead>
											<tr className="border-b border-outline-variant bg-surface-container text-on-surface-variant font-semibold">
												<th className="px-4 py-3">Adresse (Key)</th>
												<th className="px-4 py-3 w-40">Type</th>
												<th className="px-4 py-3 w-56">Physical Bundle</th>
												<th className="px-4 py-3 w-28 text-right">Taille</th>
												<th className="px-4 py-3 w-20 text-center">Déps</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-outline-variant/30 text-on-surface">
											{assets.map((asset) => {
												const active = asset.guid === selectedAssetGuid;
												return (
													<tr 
														key={asset.guid} 
														className={`transition-colors hover:bg-surface-container/30 ${
															active ? "bg-surface-container-high/80 font-semibold border-l-4 border-l-[#00aeef]" : ""
														}`}
													>
														<td className="px-4 py-3 font-mono text-xs break-all" title={`GUID: ${asset.guid}`}>
															<Link
																href={`/cross/donnees?tab=assets&page=${page}&q=${q}${assetType ? `&type=${assetType}` : ""}&asset=${asset.guid}`}
																className={`hover:underline block w-full text-left ${active ? "text-[#00aeef] font-bold" : ""}`}
															>
																{asset.key}
															</Link>
														</td>
														<td className="px-4 py-3">
															<span className="rounded-full bg-secondary-container text-on-secondary-container px-2 py-0.5 text-xs font-semibold">
																{asset.type}
															</span>
														</td>
														<td className="px-4 py-3 font-mono text-xs break-all text-on-surface-variant/80">
															{asset.bundle.length > 25 ? `${asset.bundle.substring(0, 12)}...${asset.bundle.substring(asset.bundle.length - 10)}` : asset.bundle}
														</td>
														<td className="px-4 py-3 text-right text-xs">
															{asset.size > 0 ? (asset.size / (1024 * 1024)).toFixed(2) + " Mo" : "—"}
														</td>
														<td className="px-4 py-3 text-center text-xs text-on-surface-variant">
															{asset.n_deps}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>

								{/* Pagination */}
								{totalPages > 1 && (
									<div className="flex items-center justify-between py-4">
										<div className="text-xs text-on-surface-variant">
											Page <span className="font-semibold text-on-surface">{page}</span> sur{" "}
											<span className="font-semibold text-on-surface">{totalPages}</span>
										</div>
										<div className="flex gap-2">
											<Link
												href={`/cross/donnees?tab=assets&page=${page - 1}${q ? `&q=${q}` : ""}${assetType ? `&type=${assetType}` : ""}${selectedAssetGuid ? `&asset=${selectedAssetGuid}` : ""}`}
												className={`rounded-full px-4 py-2 text-xs font-bold transition-all border ${
													page > 1
														? "bg-surface-container hover:bg-surface-container-high border-outline-variant text-on-surface"
														: "bg-surface-container/50 border-transparent text-on-surface-variant/40 pointer-events-none"
												}`}
											>
												Précédent
											</Link>
											<Link
												href={`/cross/donnees?tab=assets&page=${page + 1}${q ? `&q=${q}` : ""}${assetType ? `&type=${assetType}` : ""}${selectedAssetGuid ? `&asset=${selectedAssetGuid}` : ""}`}
												className={`rounded-full px-4 py-2 text-xs font-bold transition-all border ${
													page < totalPages
														? "bg-surface-container hover:bg-surface-container-high border-outline-variant text-on-surface"
														: "bg-surface-container/50 border-transparent text-on-surface-variant/40 pointer-events-none"
												}`}
											>
												Suivant
											</Link>
										</div>
									</div>
								)}
							</div>

							{selectedAsset && (
								<div className="w-full lg:sticky lg:top-4 z-10">
									<AssetVisualizer asset={selectedAsset} />
								</div>
							)}
						</div>
					)}
				</section>
			)}

			{/* Voix & Audios */}
			{tab === "audio" && (
				<div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
					{/* Sélecteur de personnage */}
					<div className="space-y-3">
						<h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant/70">
							Personnages ({Object.keys(audioJson.characters).length})
						</h3>
						<div className="flex flex-col gap-2">
							{Object.keys(audioJson.characters).map((charId) => {
								const active = selectedChar === charId;
								const name = CHARACTER_NAMES[charId] || charId;
								const count = (audioJson.characters as any)[charId].length;
								return (
									<Link
										key={charId}
										href={`/cross/donnees?tab=audio&char=${charId}${q ? `&q=${q}` : ""}`}
										className={`flex items-center justify-between rounded-xl px-4 py-3 border text-sm font-semibold transition-all ${
											active
												? "bg-[#00aeef] text-white border-[#00aeef] shadow-sm"
												: "bg-surface-container hover:bg-surface-container-high border-outline-variant/30 text-on-surface"
										}`}
									>
										<span>{name}</span>
										<span className={`text-xs rounded-full px-2 py-0.5 ${active ? "bg-white/25 text-white" : "bg-surface-container-highest text-on-surface-variant"}`}>
											{count} clips
										</span>
									</Link>
								);
							})}
						</div>
					</div>

					{/* Liste des clips audio */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-black text-on-surface">
								Clips audio pour {CHARACTER_NAMES[selectedChar] || selectedChar}
								{q && (
									<span className="text-on-surface-variant font-normal ml-2">
										({filteredLines.length} trouvés)
									</span>
								)}
							</h3>
						</div>

						{filteredLines.length === 0 ? (
							<div className="rounded-2xl bg-surface-container p-8 text-center border border-outline-variant/30 text-on-surface-variant">
								Aucun clip audio ne correspond à votre recherche.
							</div>
						) : (
							<div className="grid grid-cols-1 gap-3">
								{filteredLines.map((line) => {
									const fileName = `${selectedChar}_${line}.wav`;
									const audioUrl = `/inazuma-cross/audio/${fileName}`;
									// Nettoyer le nom de la ligne (enlever le préfixe numérique et remplacer les points-virgules)
									const cleanLabel = line.replace(/^\d+_c\d+_(.+)$/, "$1").replace(/_/g, " ").replace(/;/g, " /");
									return (
										<div
											key={line}
											className="rounded-2xl bg-surface-container p-4 border border-outline-variant/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
										>
											<div className="space-y-1">
												<div className="font-bold text-on-surface text-sm capitalize">{cleanLabel}</div>
												<div className="font-mono text-[10px] text-on-surface-variant/75 truncate max-w-lg" title={fileName}>
													{fileName}
												</div>
											</div>
											<div className="shrink-0 flex items-center gap-2">
												<audio src={audioUrl} controls className="h-9 max-w-[240px] sm:max-w-none" />
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
