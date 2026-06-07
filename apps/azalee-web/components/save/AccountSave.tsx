"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { resolveRoster, type ResolvedChara } from "@/lib/roster-resolver";
import { parseSave, type SaveSummary } from "@/lib/save-reader";
import { cn } from "@/lib/utils";

// Garde-fou de taille : une USERDATALIVE réelle fait ~12 Mo. On rejette au-delà de
// 30 Mo (fichier manifestement non-IEVR ou corrompu) avant tout traitement wasm.
const MAX_SIZE_BYTES = 30 * 1024 * 1024;

type Status =
	| { kind: "idle" }
	| { kind: "parsing"; filename: string }
	| { kind: "resolving"; filename: string; summary: SaveSummary }
	| {
			kind: "done";
			summary: SaveSummary;
			filename: string;
			roster: ResolvedChara[];
			matched: number;
	  }
	| { kind: "error"; message: string };

/** Formate des secondes en `XXh YYm`. */
function formatPlaytime(secs: number): string {
	const h = Math.floor(secs / 3600);
	const m = Math.floor((secs % 3600) / 60);
	return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/** Formate un horodatage natif IEVR en `YYYY-MM-DD HH:MM`. */
function formatDateTime(dt: {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
}): string {
	const p = (v: number) => v.toString().padStart(2, "0");
	return `${dt.year}-${p(dt.month)}-${p(dt.day)} ${p(dt.hour)}:${p(dt.minute)}`;
}

export function AccountSave() {
	const [status, setStatus] = useState<Status>({ kind: "idle" });
	const [dragging, setDragging] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFile = useCallback(async (file: File) => {
		if (file.size > MAX_SIZE_BYTES) {
			setStatus({
				kind: "error",
				message: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Limite : 30 Mo. Vérifiez qu'il s'agit bien d'une sauvegarde IEVR.`,
			});
			return;
		}

		setStatus({ kind: "parsing", filename: file.name });
		let summary: SaveSummary;
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			// La clé de déchiffrement dérive EXACTEMENT du nom de fichier.
			summary = await parseSave(bytes, file.name);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Impossible de lire ce fichier de sauvegarde.";
			setStatus({
				kind: "error",
				message: `${message}. Astuce : ne renommez pas le fichier — son nom d'origine sert à dériver la clé de déchiffrement.`,
			});
			return;
		}

		// Résolution des IDs du roster → noms réels (la save ne part PAS, seuls les IDs).
		setStatus({ kind: "resolving", filename: file.name, summary });
		const ids = summary.autosave?.owned_ids ?? [];
		try {
			const res = await resolveRoster(ids);
			setStatus({
				kind: "done",
				summary,
				filename: file.name,
				roster: res.resolved,
				matched: res.matched,
			});
		} catch {
			// La résolution est un bonus : si elle échoue, on affiche quand même le résumé.
			setStatus({ kind: "done", summary, filename: file.name, roster: [], matched: 0 });
		}
	}, []);

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragging(false);
			const file = e.dataTransfer.files?.[0];
			if (file) {
				void handleFile(file);
			}
		},
		[handleFile]
	);

	const onPick = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				void handleFile(file);
			}
		},
		[handleFile]
	);

	const reset = useCallback(() => {
		setStatus({ kind: "idle" });
		if (inputRef.current) {
			inputRef.current.value = "";
		}
	}, []);

	const busy = status.kind === "parsing" || status.kind === "resolving";

	return (
		<div className="flex flex-col gap-5">
			{/* Zone de dépôt */}
			{status.kind !== "done" && (
				<div
					onDragOver={(e) => {
						e.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={onDrop}
					onClick={() => inputRef.current?.click()}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							inputRef.current?.click();
						}
					}}
					role="button"
					tabIndex={0}
					aria-label="Déposer ou choisir un fichier de sauvegarde"
					className={cn(
						`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
            px-6 py-10 text-center transition-all duration-200 cursor-pointer outline-hidden`,
						"focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
						dragging
							? "border-primary bg-primary-container/40"
							: "border-outline-variant bg-surface-container hover:bg-surface-container-high"
					)}
				>
					<div
						className={cn(
							"flex size-14 items-center justify-center rounded-full transition-colors",
							dragging
								? "bg-primary text-on-primary"
								: "bg-primary-container text-on-primary-container"
						)}
					>
						<Icon name={busy ? "hourglass_top" : "add"} size={28} />
					</div>
					{status.kind === "parsing" ? (
						<>
							<p className="type-title-medium text-on-surface">Déchiffrement de la sauvegarde…</p>
							<p className="type-body-small text-on-surface-variant">{status.filename}</p>
						</>
					) : status.kind === "resolving" ? (
						<>
							<p className="type-title-medium text-on-surface">Résolution des personnages…</p>
							<p className="type-body-small text-on-surface-variant">
								{status.summary.autosave?.owned_ids.length ?? 0} identifiants
							</p>
						</>
					) : (
						<>
							<p className="type-title-medium text-on-surface">Déposez votre sauvegarde ici</p>
							<p className="type-body-small text-on-surface-variant">
								ou cliquez pour parcourir — max 30 Mo, lue dans votre navigateur
							</p>
						</>
					)}
					<input
						ref={inputRef}
						type="file"
						className="sr-only"
						onChange={onPick}
						aria-hidden="true"
					/>
				</div>
			)}

			{/* Erreur */}
			{status.kind === "error" && (
				<div className="flex items-start gap-3 rounded-xl bg-error-container px-4 py-3 text-on-error-container">
					<Icon name="error" size={20} className="mt-0.5 shrink-0" />
					<div className="flex-1">
						<p className="type-body-medium">{status.message}</p>
						<button
							type="button"
							onClick={reset}
							className="mt-2 inline-flex min-h-11 items-center type-label-large text-on-error-container underline underline-offset-2 sm:min-h-0"
						>
							Réessayer
						</button>
					</div>
				</div>
			)}

			{/* Résumé + roster résolu */}
			{status.kind === "done" && (
				<SaveResult
					summary={status.summary}
					filename={status.filename}
					roster={status.roster}
					matched={status.matched}
					onReset={reset}
				/>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------

function StatCard({
	icon,
	label,
	value,
	hint,
}: {
	icon: string;
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4 elevation-1">
			<div className="flex items-center gap-2 text-on-surface-variant">
				<Icon name={icon} size={18} />
				<span className="type-label-medium uppercase tracking-wide">{label}</span>
			</div>
			<span className="type-title-large text-on-surface">{value}</span>
			{hint && <span className="type-body-small text-on-surface-variant">{hint}</span>}
		</div>
	);
}

function SaveResult({
	summary,
	filename,
	roster,
	matched,
	onReset,
}: {
	summary: SaveSummary;
	filename: string;
	roster: ResolvedChara[];
	matched: number;
	onReset: () => void;
}) {
	const { headersave: hs, autosave: as } = summary;
	const playtimeSecs =
		as?.scalars?.playtime_secs ??
		hs?.slots.find((s) => s.playtime_secs != null)?.playtime_secs ??
		null;
	const lastSave = hs?.save_timestamp;
	const named = roster.filter((r) => r.name !== null);

	return (
		<div className="flex flex-col gap-5">
			{/* En-tête */}
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-container px-5 py-4 text-on-primary-container">
				<div className="flex items-center gap-3">
					<Icon name="check_circle" size={26} />
					<div>
						<p className="type-title-medium">Sauvegarde lue</p>
						<p className="type-body-small opacity-80">{filename}</p>
					</div>
				</div>
				<button
					type="button"
					onClick={onReset}
					className="flex min-h-11 items-center gap-1.5 rounded-full bg-on-primary-container/10 px-4 py-2 type-label-large transition-colors hover:bg-on-primary-container/20 sm:min-h-0"
				>
					<Icon name="replay" size={18} />
					Autre fichier
				</button>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
				<StatCard icon="person" label="Joueur" value={hs?.player_name || "—"} />
				<StatCard icon="stars" label="Niveau" value={hs?.level_str || "—"} />
				<StatCard
					icon="schedule"
					label="Temps de jeu"
					value={playtimeSecs != null ? formatPlaytime(playtimeSecs) : "—"}
				/>
				<StatCard
					icon="groups"
					label="Personnages possédés"
					value={as ? as.owned_count.toLocaleString("fr-FR") : "—"}
					hint={as ? `${matched.toLocaleString("fr-FR")} résolus en noms` : undefined}
				/>
				<StatCard icon="save" label="Dernière sauvegarde" value={lastSave ? formatDateTime(lastSave) : "—"} />
				<StatCard
					icon="push_pin"
					label="Emplacements"
					value={hs ? `${hs.used_slots} / ${hs.max_slots}` : "—"}
				/>
			</div>

			{/* Roster résolu */}
			{named.length > 0 && (
				<div className="rounded-xl bg-surface-container-low p-4">
					<div className="mb-3 flex items-center gap-2 text-on-surface">
						<Icon name="groups" size={18} />
						<span className="type-title-small">
							Roster — {named.length.toLocaleString("fr-FR")} personnages identifiés
						</span>
					</div>
					<RosterGrid roster={named} />
				</div>
			)}

			{/* Équipe titulaire : honnêteté (opaque dans le format actuel) */}
			<div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
				<div className="mb-2 flex items-center gap-2 text-on-surface">
					<Icon name="sports_soccer" size={18} />
					<span className="type-title-small">Équipe titulaire & formation</span>
				</div>
				<p className="type-body-small text-on-surface-variant">
					La composition active (11 titulaires + remplaçants + formation) vit dans la section
					principale de la sauvegarde, encore en cours de décodage. Le roster complet ci-dessus
					est en revanche extrait et validé à 100 % contre la base Azalée.
				</p>
			</div>

			{/* Diagnostic */}
			<details className="rounded-xl bg-surface-container-low p-4">
				<summary className="cursor-pointer type-label-large text-on-surface-variant">
					Détail technique du conteneur
				</summary>
				<div className="mt-3 overflow-x-auto">
					<table className="w-full type-body-small">
						<thead>
							<tr className="text-left text-on-surface-variant">
								<th className="pb-2 pr-4 font-medium">Bloc</th>
								<th className="pb-2 pr-4 font-medium">Type</th>
								<th className="pb-2 font-medium">Taille</th>
							</tr>
						</thead>
						<tbody className="text-on-surface">
							{summary.blobs.map((b) => (
								<tr key={b.filename} className="border-t border-outline-variant/20">
									<td className="py-1.5 pr-4">{b.filename}</td>
									<td className="py-1.5 pr-4">{b.subtype}</td>
									<td className="py-1.5">{(b.size / 1024).toFixed(0)} Ko</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</div>
	);
}

/** Couleur d'accent par élément (cohérente avec le wiki). */
const ELEMENT_TINT: Record<string, string> = {
	Feu: "text-red-400",
	Vent: "text-emerald-400",
	Forêt: "text-green-500",
	Montagne: "text-amber-500",
	Foudre: "text-yellow-400",
	Vide: "text-purple-400",
};

function RosterGrid({ roster }: { roster: ResolvedChara[] }) {
	const [expanded, setExpanded] = useState(false);
	const LIMIT = 60;
	const shown = expanded ? roster : roster.slice(0, LIMIT);
	return (
		<>
			<ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
				{shown.map((c) => {
					const tint = (c.element && ELEMENT_TINT[c.element]) || "text-on-surface";
					const inner = (
						<span className="flex min-w-0 items-center gap-1.5">
							<Icon name="blur_on" size={12} className={cn("shrink-0", tint)} />
							<span className="truncate type-body-small text-on-surface">{c.name}</span>
						</span>
					);
					return (
						<li
							key={c.id}
							className="rounded-md bg-surface-container px-2.5 py-2 transition-colors hover:bg-surface-container-high md:py-1.5"
							title={[c.element, c.position, c.rarity].filter(Boolean).join(" · ")}
						>
							{c.baseSlug ? (
								<Link href={`/chara/${c.baseSlug}`} className="block">
									{inner}
								</Link>
							) : (
								inner
							)}
						</li>
					);
				})}
			</ul>
			{roster.length > LIMIT && (
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className="mt-3 inline-flex min-h-11 items-center type-label-large text-primary underline underline-offset-2 sm:min-h-0"
				>
					{expanded
						? "Réduire"
						: `Afficher les ${roster.length.toLocaleString("fr-FR")} personnages`}
				</button>
			)}
		</>
	);
}
