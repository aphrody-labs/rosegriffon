export const dynamic = "force-dynamic";

import { ArrowRight, Database, KeyRound, Lock, Music, Table2 } from "lucide-react";
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

export const metadata: Metadata = {
	alternates: { canonical: "/cross/donnees" },
	description:
		"Modèle de données d'Inazuma Eleven Cross extrait par rétro-ingénierie statique du jeu (Unity IL2CPP) : 153 tables masterdata typées, 214 énumérations, catalogue d'assets. Les valeurs de jeu restent côté serveur.",
	title: "Données extraites | Inazuma Eleven Cross - Azalée",
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

	const status = getCrossStatus();
	const counts = getCrossDataCounts();
	const tables = getCrossTables(q);
	const enums = getCrossEnums(q);
	const stats = getCrossCatalogStats();
	const totals = (stats.totals ?? {}) as Record<string, number>;
	const catalogObjects = totals.loadable_objects ?? totals.rows ?? 0;

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
					Victory Road). Schéma, types et énumérations sont réels ; les <strong>valeurs</strong> de jeu
					(stats des joueurs, hissatsu…) sont servies par le serveur du jeu et ne sont pas encore
					récupérées.
				</p>
				<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5">
					<StatTile icon={<Table2 size={16} />} value={String(counts.tables)} label="tables masterdata" />
					<StatTile icon={<Database size={16} />} value={String(counts.columns)} label="colonnes typées" />
					<StatTile icon={<KeyRound size={16} />} value={String(counts.enums)} label="énumérations" />
					<StatTile
						icon={<Database size={16} />}
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
					<strong>modèle</strong>, jamais de valeur inventée. Localisation du jeu : {status.localization_langs.join(" / ")}.
				</p>
			</div>

			{/* Recherche */}
			<form className="flex gap-2" action="/cross/donnees">
				<input
					type="search"
					name="q"
					defaultValue={q}
					placeholder="Filtrer tables et énumérations…"
					className="flex-1 rounded-full bg-surface-container px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-2"
					style={{ outlineColor: CROSS_CYAN }}
				/>
			</form>

			{/* Tables masterdata */}
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

			{/* Enums */}
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
		</div>
	);
}
