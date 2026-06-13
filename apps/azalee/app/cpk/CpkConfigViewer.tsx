"use client";

/**
 * Viewer d'un `cfg.bin` : tente d'abord le décodage TYPÉ (`/typed` → structures de jeu
 * nommées via nie-data), avec un rendu spécialisé par famille (terrain pour `formation`),
 * sinon l'arbre JSON de la donnée typée, sinon le RDBN/T2B brut (`/typed` générique ou
 * repli `/cfg`). Remplace l'ancien dump `<pre>` brut.
 */
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { CpkFormationViewer } from "@/app/cpk/CpkFormationViewer";
import { CpkHexViewer } from "@/app/cpk/CpkHexViewer";
import { CpkJsonTree } from "@/app/cpk/CpkJsonTree";
import { CpkTypedTable } from "@/app/cpk/CpkTypedTable";
import { cpkCfgUrl, cpkRawUrl } from "@/lib/cpk/shared";
import { cfgbinTyped } from "@/lib/cpk-wasm";

/** Libellé humain d'une famille de jeu (badge). */
const FAMILY_LABEL: Record<string, string> = {
	formation: "Formations",
	skill: "Hissatsu / techniques",
	item: "Objets",
	mission: "Missions",
	aura: "Auras / esprits guerriers",
	trophy: "Trophées",
	gallery: "Galerie",
	chara_param: "Paramètres personnages",
	exp: "Tables d'expérience",
	soccer_game: "Règles de match",
	dungeon: "Donjons / gimmicks",
	chara_bank: "Club / vestiaire",
	dictionary: "Dictionnaire",
	weather: "Météo",
	craft: "Artisanat",
};

interface State {
	status: "loading" | "typed" | "generic" | "error";
	family?: string | null;
	data?: unknown;
}

export function CpkConfigViewer({ path }: { path: string }) {
	const [state, setState] = useState<State>({ status: "loading" });

	useEffect(() => {
		let cancelled = false;
		setState({ status: "loading" });

		(async () => {
			const filename = path.split("/").pop() ?? path;
			// 1. Décodage typé NATIF IN-BROWSER (wasm nie-data) depuis les octets bruts (/raw).
			//    Mêmes parseurs Rust que le jeu — aucune dépendance à la route serveur /typed.
			try {
				const res = await fetch(cpkRawUrl(path));
				if (res.ok) {
					const bytes = new Uint8Array(await res.arrayBuffer());
					const body = await cfgbinTyped(bytes, filename);
					if (cancelled) return;
					if (body.family) {
						setState({ status: "typed", family: body.family, data: body.data });
					} else {
						setState({ status: "generic", family: null, data: body.generic });
					}
					return;
				}
			} catch {
				/* octets non RDBN/T2B ou wasm indispo → repli serveur /cfg */
			}
			// 2. Repli serveur : /cfg (formats hiérarchiques hors RDBN/T2B à listes).
			try {
				const res = await fetch(cpkCfgUrl(path));
				if (!res.ok) throw new Error(String(res.status));
				const body = (await res.json()) as unknown;
				if (!cancelled) setState({ status: "generic", family: null, data: body });
			} catch {
				if (!cancelled) setState({ status: "error" });
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [path]);

	if (state.status === "loading") {
		return (
			<div className="flex items-center justify-center p-10">
				<div className="animate-spin rounded-full size-7 border-b-2 border-primary" />
			</div>
		);
	}

	if (state.status === "error") {
		// Pas un cfg.bin RDBN/T2B (ex. .objbin/.fxbin/.bin binaire opaque) → dump hexadécimal
		// utile plutôt qu'un cul-de-sac. Le bouton de téléchargement vit dans CpkFilePreview.
		return (
			<div>
				<div className="px-4 pt-3">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant">
						<Icon name="memory" size={14} /> Binaire opaque — aperçu hexadécimal
					</span>
				</div>
				<CpkHexViewer url={cpkRawUrl(path)} />
			</div>
		);
	}

	const { family, data } = state;

	// Rendu spécialisé : terrain de formation.
	if (state.status === "typed" && family === "formation") {
		return (
			<div>
				<FamilyBadge family={family} />
				<CpkFormationViewer data={data as never} />
			</div>
		);
	}

	// Famille typée reconnue → table (si liste d'objets) ou arbre JSON (sinon).
	if (state.status === "typed" && family) {
		return (
			<div>
				<FamilyBadge family={family} />
				<CpkTypedTable data={data} />
			</div>
		);
	}

	// Générique (RDBN/T2B brut ou /cfg) → arbre JSON.
	return (
		<div>
			<div className="px-4 pt-3">
				<span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 text-xs text-on-surface-variant">
					<Icon name="data_object" size={14} /> Config binaire brute (RDBN / T2B)
				</span>
			</div>
			<CpkJsonTree data={data} rootLabel="config" />
		</div>
	);
}

function FamilyBadge({ family }: { family: string }) {
	return (
		<div className="px-4 pt-3">
			<span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-semibold">
				<Icon name="auto_awesome" size={14} />
				{FAMILY_LABEL[family] ?? family} · décodé par niers
			</span>
		</div>
	);
}
