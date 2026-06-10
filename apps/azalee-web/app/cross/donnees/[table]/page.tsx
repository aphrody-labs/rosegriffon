export const dynamic = "force-dynamic";

import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CROSS_CYAN, KIND_LABELS, KIND_TONE } from "@/lib/cross/data-shared";
import { getCrossTable, getCrossTables } from "@/lib/cross/data";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ table: string }>;
}): Promise<Metadata> {
	const { table } = await params;
	const slug = decodeURIComponent(table);
	const t = getCrossTable(slug);
	if (!t) return { title: "Table inconnue | Inazuma Eleven Cross - Azalée" };
	return {
		alternates: { canonical: `/cross/donnees/${slug}` },
		description: `Schéma de la table masterdata ${t.short} (${t.columns.length} colonnes) d'Inazuma Eleven Cross — fichier ${t.file}.`,
		title: `${t.short} | Données Inazuma Eleven Cross - Azalée`,
	};
}

export default async function CrossTablePage({
	params,
}: {
	params: Promise<{ table: string }>;
}) {
	const { table } = await params;
	const slug = decodeURIComponent(table);
	const t = getCrossTable(slug);
	if (!t) notFound();

	const knownTables = new Set(getCrossTables().map((x) => x.short));

	return (
		<div className="w-full space-y-6">
			<Link
				href="/cross/donnees"
				className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
			>
				<ArrowLeft size={16} /> Toutes les tables
			</Link>

			<div className="rounded-3xl p-5 border-2" style={{ borderColor: CROSS_CYAN }}>
				<h1 className="text-2xl lg:text-3xl font-black text-on-surface tracking-tight">{t.short}</h1>
				<p className="text-sm text-on-surface-variant font-mono mt-1">{t.fullName}</p>
				<div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-on-surface-variant">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1">
						<FileSpreadsheet size={13} /> {t.file}
					</span>
					<span className="rounded-full bg-primary-container text-on-primary-container px-3 py-1">
						{t.columns.length} colonnes
					</span>
					{t.extends && (
						<span className="rounded-full bg-secondary-container text-on-secondary-container px-3 py-1">
							hérite de {t.extends.split(".").pop()}
						</span>
					)}
				</div>
				{t.relatedFiles && t.relatedFiles.length > 0 && (
					<p className="text-xs text-on-surface-variant mt-2">
						Fichiers TSV liés : {t.relatedFiles.length}
					</p>
				)}
			</div>

			<div className="overflow-hidden rounded-2xl border border-outline-variant/60">
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
												href={`/cross/donnees/${encodeURIComponent(c.ref.split(".").pop() ?? "")}`}
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
			</div>
		</div>
	);
}
