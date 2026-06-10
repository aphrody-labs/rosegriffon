export const dynamic = "force-dynamic";

import { ArrowLeft, FileSpreadsheet, Cpu } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CROSS_CYAN, KIND_LABELS, KIND_TONE, TABLE_METADATA, humanizeClassName } from "@/lib/cross/data-shared";
import { getCrossTable, getCrossTables, getCrossTypeFields, generateCSharpClass } from "@/lib/cross/data";
import { CSharpCodeViewer } from "./CSharpCodeViewer";

export function humanizeColumnName(name: string): string {
	let res = name;
	if (res.endsWith("Id")) res = res.substring(0, res.length - 2);
	if (res.endsWith("Key")) res = res.substring(0, res.length - 3) + "Clé";
	if (res.endsWith("Path")) res = res.substring(0, res.length - 4) + "Chemin";
	if (res.startsWith("is")) res = res.substring(2);
	else if (res.startsWith("Is")) res = res.substring(2);

	res = res.replace(/([A-Z])/g, " $1").trim();

	res = res
		.replace(/\bCharacter\b/gi, "Joueur")
		.replace(/\bSpecial\s*Move\b/gi, "Technique")
		.replace(/\bMove\b/gi, "Technique")
		.replace(/\bItem\b/gi, "Objet")
		.replace(/\bAffinities\b/gi, "Affinités")
		.replace(/\bAffinity\b/gi, "Affinité")
		.replace(/\bRank\b/gi, "Rang")
		.replace(/\bReward\b/gi, "Récompense")
		.replace(/\bLevel\b/gi, "Niveau")
		.replace(/\bMin\b/gi, "Minimum")
		.replace(/\bMax\b/gi, "Maximum")
		.replace(/\bName\b/gi, "Nom")
		.replace(/\bDesc\b/gi, "Description")
		.replace(/\bDescription\b/gi, "Description")
		.replace(/\bIcon\b/gi, "Icône")
		.replace(/\bValue\b/gi, "Valeur")
		.replace(/\bProbability\b/gi, "Probabilité")
		.replace(/\bActive\b/gi, "Actif")
		.replace(/\bUnlock\b/gi, "Déblocage")
		.replace(/\bCondition\b/gi, "Condition")
		.replace(/\bCost\b/gi, "Coût")
		.replace(/\bType\b/gi, "Type")
		.replace(/\bCount\b/gi, "Quantité")
		.replace(/\bAmount\b/gi, "Montant")
		.replace(/\bRate\b/gi, "Taux")
		.replace(/\bPrice\b/gi, "Prix")
		.replace(/\bQuest\b/gi, "Quête")
		.replace(/\bMission\b/gi, "Mission")
		.replace(/\bTeam\b/gi, "Équipe")
		.replace(/\bEnemy\b/gi, "Ennemi")
		.replace(/\bBackground\b/gi, "Fond d'écran")
		.replace(/\bTexture\b/gi, "Texture")
		.replace(/\bSprite\b/gi, "Sprite")
		.replace(/\bColor\b/gi, "Couleur")
		.replace(/\bSound\b/gi, "Son")
		.replace(/\bBgm\b/gi, "Musique")
		.replace(/\bCategory\b/gi, "Catégorie")
		.replace(/\bIndex\b/gi, "Index")
		.replace(/\bOrder\b/gi, "Ordre")
		.replace(/\bGroup\b/gi, "Groupe")
		.replace(/\bLimit\b/gi, "Limite")
		.replace(/\bTime\b/gi, "Temps")
		.replace(/\bDate\b/gi, "Date")
		.replace(/\bRequired\b/gi, "Requis")
		.replace(/\bRecipe\b/gi, "Recette");

	return res;
}

export async function generateMetadata({
	params,
	searchParams,
}: {
	params: Promise<{ table: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
	const { table } = await params;
	const sp = await searchParams;
	const dev = sp.dev === "true";
	const slug = decodeURIComponent(table);
	const t = getCrossTable(slug);
	if (!t) return { title: "Table inconnue | Inazuma Eleven Cross - Azalée" };
	
	const meta = TABLE_METADATA[t.short] || {
		label: humanizeClassName(t.short),
		desc: `Caractéristiques de la table masterdata ${t.short}.`
	};

	const title = dev 
		? `${t.short} | Données Inazuma Eleven Cross - Azalée`
		: `${meta.label} | Encyclopédie Inazuma Eleven Cross - Azalée`;

	const description = dev
		? `Schéma de la table masterdata ${t.short} (${t.columns.length} colonnes) d'Inazuma Eleven Cross — fichier ${t.file}.`
		: `${meta.desc} Explorez la structure simplifiée des données du jeu mobile Inazuma Eleven Cross.`;

	return {
		alternates: { canonical: `/cross/donnees/${slug}` },
		description,
		title,
	};
}

export default async function CrossTablePage({
	params,
	searchParams,
}: {
	params: Promise<{ table: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { table } = await params;
	const sp = await searchParams;
	const dev = sp.dev === "true";
	const slug = decodeURIComponent(table);
	const t = getCrossTable(slug);
	if (!t) notFound();

	const typeFields = getCrossTypeFields(t.fullName);
	const csharpCode = generateCSharpClass(t, typeFields);

	const knownTables = new Set(getCrossTables().map((x) => x.short));

	const meta = TABLE_METADATA[t.short] || {
		label: humanizeClassName(t.short),
		desc: `Fiche technique des données du système de jeu ${humanizeClassName(t.short).toLowerCase()}.`
	};

	return (
		<div className="w-full space-y-6">
			<Link
				href={`/cross/donnees${dev ? "?dev=true" : ""}`}
				className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
			>
				<ArrowLeft size={16} /> Retour à l'exploration
			</Link>

			<div className="rounded-3xl p-5 border-2" style={{ borderColor: CROSS_CYAN, background: `linear-gradient(135deg, ${CROSS_CYAN}0a, transparent 70%)` }}>
				<h1 className="text-2xl lg:text-3xl font-black text-on-surface tracking-tight">
					{dev ? t.short : meta.label}
				</h1>
				<p className="text-sm text-on-surface-variant mt-1">
					{dev ? t.fullName : meta.desc}
				</p>
				<div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-on-surface-variant">
					{dev && (
						<span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1">
							<FileSpreadsheet size={13} /> {t.file}
						</span>
					)}
					<span className="rounded-full bg-primary-container text-on-primary-container px-3 py-1 font-semibold">
						{t.columns.length} {dev ? "colonnes" : "caractéristiques"}
					</span>
					{t.extends && (
						<span className="rounded-full bg-secondary-container text-on-secondary-container px-3 py-1 font-semibold">
							{dev 
								? `hérite de ${t.extends.split(".").pop()}` 
								: `Hérite de ${TABLE_METADATA[t.extends.split(".").pop() ?? ""]?.label || humanizeClassName(t.extends.split(".").pop() ?? "")}`}
						</span>
					)}
				</div>
				{dev && t.relatedFiles && t.relatedFiles.length > 0 && (
					<p className="text-xs text-on-surface-variant mt-2 font-mono">
						Fichiers TSV liés : {t.relatedFiles.join(", ")}
					</p>
				)}
			</div>

			<div className="overflow-hidden rounded-2xl border border-outline-variant/60">
				{dev ? (
					<table className="w-full text-sm">
						<thead className="bg-surface-container-high text-on-surface-variant text-xs uppercase tracking-wide">
							<tr>
								<th className="text-left font-semibold px-4 py-2.5">Colonne</th>
								<th className="text-left font-semibold px-4 py-2.5">Type</th>
								<th className="text-left font-semibold px-4 py-2.5">Détail</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-outline-variant/40">
							{t.columns.map((c, i) => (
								<tr key={`${c.name}-${i}`} className="hover:bg-surface-container/40">
									<td className="px-4 py-2.5 font-medium text-on-surface align-top">
										{c.name}
										{c.inherited && (
											<span className="ml-1.5 text-[10px] text-on-surface-variant" title={`hérité de ${c.from ?? ""}`}>
												↑
											</span>
										)}
									</td>
									<td className="px-4 py-2.5 align-top">
										<span
											className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${KIND_TONE[c.kind] ?? "bg-surface-container text-on-surface-variant"}`}
										>
											{KIND_LABELS[c.kind] ?? c.kind}
										</span>
									</td>
									<td className="px-4 py-2.5 align-top text-on-surface-variant">
										{c.kind === "ref" && c.ref ? (
											knownTables.has(c.ref.split(".").pop() ?? "") ? (
												<Link
													href={`/cross/donnees/${encodeURIComponent(c.ref.split(".").pop() ?? "")}?dev=true`}
													className="font-mono text-xs hover:underline"
													style={{ color: CROSS_CYAN }}
												>
													→ {c.ref.split(".").pop()}
												</Link>
											) : (
												<span className="font-mono text-xs">→ {c.ref.split(".").pop()}</span>
											)
										) : c.kind === "enum" && c.enumValues ? (
											<span className="flex flex-wrap gap-1">
												{c.enumValues.slice(0, 12).map((m) => (
													<span
														key={m.name}
														className="rounded bg-surface-container-highest px-1.5 py-0.5 text-[11px]"
													>
														{m.name}
													</span>
												))}
											</span>
										) : c.kind === "array" || c.kind === "list" ? (
											<span className="font-mono text-xs">{c.element ?? c.type}[]</span>
										) : c.kind === "dict" ? (
											<span className="font-mono text-xs">{`{${c.key ?? "?"}: ${c.value ?? "?"}}`}</span>
										) : (
											<span className="font-mono text-xs">{c.type}</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				) : (
					<table className="w-full text-sm">
						<thead className="bg-surface-container-high text-on-surface-variant text-xs uppercase tracking-wide">
							<tr>
								<th className="text-left font-semibold px-4 py-2.5">Donnée</th>
								<th className="text-left font-semibold px-4 py-2.5">Description</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-outline-variant/40">
							{t.columns.map((c, i) => {
								const humanName = humanizeColumnName(c.name);
								const typeLabel = KIND_LABELS[c.kind] ?? c.kind;
								return (
									<tr key={`${c.name}-${i}`} className="hover:bg-surface-container/40">
										<td className="px-4 py-3.5 font-bold text-on-surface align-top w-1/3">
											{humanName}
										</td>
										<td className="px-4 py-3.5 align-top text-on-surface-variant space-y-2">
											<div className="flex items-center gap-2">
												<span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${KIND_TONE[c.kind] ?? "bg-surface-container text-on-surface-variant"}`}>
													{typeLabel}
												</span>
												{c.inherited && (
													<span className="text-[10px] bg-surface-container-highest px-1.5 py-0.5 rounded text-on-surface-variant font-medium" title="Donnée commune héritée d'un modèle parent">
														Hérité
													</span>
												)}
											</div>
											
											{/* Détails complémentaires selon le type */}
											<div className="text-xs leading-relaxed text-on-surface-variant">
												{c.kind === "ref" && c.ref ? (() => {
													const refShort = c.ref.split(".").pop() ?? "";
													const targetLabel = TABLE_METADATA[refShort]?.label || humanizeClassName(refShort);
													return knownTables.has(refShort) ? (
														<span>
															Référence vers la section{" "}
															<Link
																href={`/cross/donnees/${encodeURIComponent(refShort)}`}
																className="font-bold hover:underline"
																style={{ color: CROSS_CYAN }}
															>
																{targetLabel}
															</Link>.
														</span>
													) : (
														<span>Référence vers {targetLabel}.</span>
													);
												})() : c.kind === "enum" && c.enumValues ? (
													<div className="space-y-1">
														<div className="text-[10px] font-semibold text-on-surface-variant/80">Valeurs possibles :</div>
														<div className="flex flex-wrap gap-1">
															{c.enumValues.slice(0, 12).map((m) => (
																<span
																	key={m.name}
																	className="rounded bg-surface-container-highest px-1.5 py-0.5 text-[11px] font-medium text-on-surface"
																>
																	{m.name}
																</span>
															))}
															{c.enumValues.length > 12 && (
																<span className="text-[11px] text-on-surface-variant/70 font-medium">
																	+{c.enumValues.length - 12} autres
																</span>
															)}
														</div>
													</div>
												) : c.kind === "array" || c.kind === "list" ? (
													<span>Liste d'éléments de type {KIND_LABELS[c.element ?? ""] ?? c.element ?? c.type}.</span>
												) : c.kind === "dict" ? (
													<span>Association de clés ({KIND_LABELS[c.key ?? ""] ?? c.key ?? "?"}) vers des valeurs ({KIND_LABELS[c.value ?? ""] ?? c.value ?? "?"}).</span>
												) : c.kind === "localizationKey" ? (
													<span>Identifiant unique servant à récupérer le texte traduit en jeu (nom, description, dialogue, etc.).</span>
												) : c.kind === "bool" ? (
													<span>Indicateur binaire (vrai ou faux / activé ou désactivé).</span>
												) : c.kind === "int" || c.kind === "float" ? (
													<span>Valeur numérique utilisée pour les calculs internes du jeu.</span>
												) : (
													<span>Donnée textuelle brute.</span>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</div>

			{dev && (
				<div className="mt-8">
					<details className="group border border-outline-variant/40 rounded-2xl bg-surface-container-low overflow-hidden">
						<summary className="flex items-center justify-between px-5 py-4 font-bold text-sm text-on-surface-variant cursor-pointer hover:bg-surface-container-high/40 transition-colors select-none">
							<div className="flex items-center gap-2">
								<Cpu className="size-4 text-on-surface-variant/70" />
								<span>Rétro-ingénierie & Code C# de mapping (Développeurs)</span>
							</div>
							<span className="text-xs text-on-surface-variant/60 font-mono group-open:hidden">Afficher ↓</span>
							<span className="text-xs text-on-surface-variant/60 font-mono hidden group-open:inline">Masquer ↑</span>
						</summary>
						<div className="p-4 border-t border-outline-variant/30 bg-surface-container-lowest">
							<p className="text-xs text-on-surface-variant/80 mb-4 leading-relaxed">
								Ce code C# a été généré à la volée en corrélant les colonnes typées du masterdata et le dump des structures IL2CPP du binaire du jeu.
							</p>
							<CSharpCodeViewer code={csharpCode} fullName={t.fullName} />
						</div>
					</details>
				</div>
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
							: "Vous explorez actuellement la version humanisée des caractéristiques du jeu. Les codes sources C#, les fichiers de données bruts (.tsv) et les namespaces techniques sont masqués."}
					</p>
				</div>
				<Link 
					href={dev 
						? `/cross/donnees/${encodeURIComponent(slug)}` 
						: `/cross/donnees/${encodeURIComponent(slug)}?dev=true`}
					className="rounded-full bg-surface-container-high hover:bg-surface-container-highest px-4 py-2 text-xs font-bold text-on-surface border border-outline-variant/50 cursor-pointer text-center whitespace-nowrap shrink-0 transition-colors"
				>
					{dev ? "Désactiver le mode Développeur" : "Activer le mode Développeur"}
				</Link>
			</div>
		</div>
	);
}

