import React from "react";
import Link from "next/link";
import AssetVisualizer from "./AssetVisualizer";

interface AssetInfo {
	guid: string;
	key: string;
	type: string;
	bundle: string;
	size: number;
	n_deps: number;
}

interface AssetsTabProps {
	assets: AssetInfo[];
	totalAssets: number;
	selectedAssetGuid: string;
	selectedAsset: any;
	page: number;
	q: string;
	assetType: string;
	totalPages: number;
}

export function AssetsTab({
	assets,
	totalAssets,
	selectedAssetGuid,
	selectedAsset,
	page,
	q,
	assetType,
	totalPages,
}: AssetsTabProps) {
	return (
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
	);
}
