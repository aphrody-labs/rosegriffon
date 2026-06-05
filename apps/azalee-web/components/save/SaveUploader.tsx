"use client";

import { useCallback, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { parseSave, type SaveSummary } from "@/lib/save-reader";

// Garde-fou de taille : une USERDATALIVE réelle fait ~12 Mo. On rejette au-delà
// de 30 Mo (fichier manifestement non-IEVR ou corrompu) avant tout traitement wasm.
const MAX_SIZE_BYTES = 30 * 1024 * 1024;

type Status =
	| { kind: "idle" }
	| { kind: "parsing"; filename: string }
	| { kind: "done"; summary: SaveSummary; filename: string }
	| { kind: "error"; message: string };

/** Formate des secondes en `XXh YYm` (temps de jeu). */
function formatPlaytime(secs: number): string {
	const h = Math.floor(secs / 3600);
	const m = Math.floor((secs % 3600) / 60);
	return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/** Formate un octet-count humainement. */
function formatBytes(n: number): string {
	if (n >= 1024 * 1024) {
		return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
	}
	if (n >= 1024) {
		return `${(n / 1024).toFixed(0)} Ko`;
	}
	return `${n} o`;
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

export function SaveUploader() {
	const [status, setStatus] = useState<Status>({ kind: "idle" });
	const [dragging, setDragging] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFile = useCallback(async (file: File) => {
		if (file.size > MAX_SIZE_BYTES) {
			setStatus({
				kind: "error",
				message: `Fichier trop volumineux (${formatBytes(file.size)}). Limite : 30 Mo. Vérifiez qu'il s'agit bien d'une sauvegarde IEVR.`,
			});
			return;
		}

		setStatus({ kind: "parsing", filename: file.name });
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			// La clé de déchiffrement dérive EXACTEMENT du nom de fichier.
			const summary = await parseSave(bytes, file.name);
			setStatus({ kind: "done", summary, filename: file.name });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Impossible de lire ce fichier de sauvegarde.";
			// Message d'aide : la cause la plus fréquente est un nom de fichier renommé
			// (la clé CRC32 ne correspond plus) ou un fichier qui n'est pas une save IEVR.
			setStatus({
				kind: "error",
				message: `${message}. Astuce : ne renommez pas le fichier — son nom d'origine sert à dériver la clé de déchiffrement.`,
			});
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

	return (
		<div className="flex flex-col gap-6">
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
						`
        relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12
        text-center transition-all duration-200 cursor-pointer outline-hidden
      `,
						"focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
						dragging
							? "border-primary bg-primary-container/40"
							: `
         border-outline-variant bg-surface-container
         hover:bg-surface-container-high
       `
					)}
				>
					<div
						className={cn(
							"flex size-16 items-center justify-center rounded-full transition-colors",
							dragging ? "bg-primary text-on-primary" : "bg-primary-container text-on-primary-container"
						)}
					>
						<Icon name={status.kind === "parsing" ? "hourglass_top" : "add"} size={32} />
					</div>
					{status.kind === "parsing" ? (
						<>
							<p className="type-title-medium text-on-surface">Analyse en cours…</p>
							<p className="type-body-small text-on-surface-variant">{status.filename}</p>
						</>
					) : (
						<>
							<p className="type-title-medium text-on-surface">
								Déposez votre sauvegarde ici
							</p>
							<p className="type-body-small text-on-surface-variant">
								ou cliquez pour parcourir — max 30 Mo, traité localement
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
							className="mt-2 type-label-large text-on-error-container underline underline-offset-2"
						>
							Réessayer
						</button>
					</div>
				</div>
			)}

			{/* Résumé */}
			{status.kind === "done" && (
				<SaveResume summary={status.summary} filename={status.filename} onReset={reset} />
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Résumé
// ---------------------------------------------------------------------------

function StatCard({
	icon,
	label,
	value,
	hint,
	soon = false,
}: {
	icon: string;
	label: string;
	value: string;
	hint?: string;
	soon?: boolean;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-xl bg-surface-container p-4 elevation-1">
			<div className="flex items-center gap-2 text-on-surface-variant">
				<Icon name={icon} size={18} />
				<span className="type-label-medium uppercase tracking-wide">{label}</span>
			</div>
			{soon ? (
				<span className="type-title-medium text-on-surface-variant/60 italic">Bientôt</span>
			) : (
				<span className="type-title-large text-on-surface">{value}</span>
			)}
			{hint && !soon && <span className="type-body-small text-on-surface-variant">{hint}</span>}
		</div>
	);
}

function SaveResume({
	summary,
	filename,
	onReset,
}: {
	summary: SaveSummary;
	filename: string;
	onReset: () => void;
}) {
	const { headersave: hs, autosave: as } = summary;

	// Temps de jeu : priorité aux scalaires AUTOSAVE (validés au réel), sinon
	// le premier slot HEADERSAVE horodaté.
	const playtimeSecs =
		as?.scalars?.playtime_secs ??
		hs?.slots.find((s) => s.playtime_secs != null)?.playtime_secs ??
		null;

	const lastSave = hs?.save_timestamp;

	return (
		<div className="flex flex-col gap-5">
			{/* En-tête du résumé */}
			<div className="
     flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-container px-5 py-4
     text-on-primary-container
   ">
				<div className="flex items-center gap-3">
					<Icon name="check_circle" size={28} />
					<div>
						<p className="type-title-medium">Sauvegarde lue</p>
						<p className="type-body-small opacity-80">{filename}</p>
					</div>
				</div>
				<button
					type="button"
					onClick={onReset}
					className="
       flex items-center gap-1.5 rounded-full bg-on-primary-container/10 px-4 py-2 type-label-large transition-colors
       hover:bg-on-primary-container/20
     "
				>
					<Icon name="replay" size={18} />
					Autre fichier
				</button>
			</div>

			{/* Grille de stats */}
			<div className="
     grid grid-cols-2 gap-3
     sm:grid-cols-3
   ">
				<StatCard
					icon="person"
					label="Joueur"
					value={hs?.player_name || "—"}
					soon={!hs?.player_name}
				/>
				<StatCard
					icon="stars"
					label="Niveau"
					value={hs?.level_str || "—"}
					soon={!hs?.level_str}
				/>
				<StatCard
					icon="schedule"
					label="Temps de jeu"
					value={playtimeSecs != null ? formatPlaytime(playtimeSecs) : "—"}
					hint={playtimeSecs != null ? `${playtimeSecs.toLocaleString("fr-FR")} s` : undefined}
					soon={playtimeSecs == null}
				/>
				<StatCard
					icon="groups"
					label="Personnages possédés"
					value={as ? as.owned_count.toLocaleString("fr-FR") : "—"}
					hint={as ? `sur ${as.roster_slots.toLocaleString("fr-FR")} emplacements` : undefined}
					soon={!as}
				/>
				<StatCard
					icon="save"
					label="Dernière sauvegarde"
					value={lastSave ? formatDateTime(lastSave) : "—"}
					soon={!lastSave}
				/>
				<StatCard
					icon="push_pin"
					label="Emplacements utilisés"
					value={hs ? `${hs.used_slots} / ${hs.max_slots}` : "—"}
					soon={!hs}
				/>
			</div>

			{/* Identité de la save */}
			{hs?.unique_id && (
				<div className="rounded-xl bg-surface-container p-4">
					<div className="flex items-center gap-2 text-on-surface-variant">
						<Icon name="tag" size={18} />
						<span className="type-label-medium uppercase tracking-wide">Identifiant unique</span>
					</div>
					<code className="mt-1 block break-all type-body-small text-on-surface">
						{hs.unique_id}
					</code>
				</div>
			)}

			{/* Champs encore opaques : transparence honnête */}
			<div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
				<div className="mb-3 flex items-center gap-2 text-on-surface">
					<Icon name="build" size={18} />
					<span className="type-title-small">En cours de décodage</span>
				</div>
				<ul className="flex flex-col gap-1.5 type-body-small text-on-surface-variant">
					<li className="flex items-center gap-2">
						<Icon name="schedule" size={16} className="opacity-60" />
						Argent / pièces — <span className="italic">bientôt</span>
					</li>
					<li className="flex items-center gap-2">
						<Icon name="schedule" size={16} className="opacity-60" />
						Équipe titulaire & formation — <span className="italic">bientôt</span>
					</li>
					<li className="flex items-center gap-2">
						<Icon name="schedule" size={16} className="opacity-60" />
						Noms & rangs des personnages du roster — <span className="italic">bientôt</span>
					</li>
					<li className="flex items-center gap-2">
						<Icon name="schedule" size={16} className="opacity-60" />
						Progression histoire & inventaire — <span className="italic">bientôt</span>
					</li>
				</ul>
				{as && (
					<p className="mt-3 type-body-small text-on-surface-variant/70">
						Section principale non décodée :{" "}
						{formatBytes(as.main_data_range[1] - as.main_data_range[0])} de données brutes.
					</p>
				)}
			</div>

			{/* Détail des blobs (diagnostic) */}
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
									<td className="py-1.5">{formatBytes(b.size)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</div>
	);
}
