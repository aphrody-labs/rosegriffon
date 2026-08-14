/**
 * Les modes de jeu, et ce dont chacun est fait.
 *
 * Un mode est une tuile du menu principal. Le jeu n'en garde nulle part la liste en clair — son
 * script de menu désigne ses onglets par un entier — mais chaque mode s'adosse à des écrans
 * `*_setting.cfg.bin` bien réels, et de ces écrans découle tout le reste : les calques, les
 * objets de menu, les maillages de menu (`g4pkm`), les textures et les scripts.
 *
 * Deux vues, une route :
 *   /mode           les modes et leur volume
 *   /mode/<slug>    la fiche : écrans, scripts, et les assets par famille
 *
 * La source est le catalogue produit par `niers mode index` puis `niers mode export`. Ce qui est
 * affiché est donc compté sur le VFS du jeu, pas rédigé à la main — y compris quand le compte
 * est zéro, ce qui est en soi une information : un mode sans texture propre est un mode dont
 * l'habillage n'est pas dans les fichiers installés.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { MediaBack, MediaCount, MediaEmpty, MediaHeader } from "@/components/wiki/MediaShell";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Un mode tel que l'exporte `niers mode export`. */
type Mode = {
	slug: string;
	/** Libellé français, tel que le jeu l'affiche quand il en fournit un. */
	label: string;
	labelEn: string | null;
	labelJa: string | null;
	/**
	 * Vrai si le jeu énumère lui-même ce mode. La liste ne vient pas de nous : `menu_text`
	 * porte un réglage audio par mode (« Volume de la musique (…) »), et trois familles de
	 * réglages concordent sur les mêmes cinq entrées.
	 */
	official: boolean;
	icon: { atlas: string | null; region: string | null };
	counts: { screens: number; layers: number; focus: number };
	note: string | null;
	screens: { screen: string; cfg: string }[];
	assets: Record<string, string[]>;
};

/**
 * Racine des données du jeu — même convention que le reste de l'app (`DATA_PATH`), pour qu'un
 * déplacement du dump ne demande pas de toucher au code.
 */
const CATALOGUE = path.join(process.env.DATA_PATH ?? "/home/ubuntu/niers/data", "modes.json");

/** Libellé lisible d'une famille d'assets, et ordre d'affichage. */
const FAMILLES: { kind: string; label: string; hint: string }[] = [
	{ kind: "screen", label: "Écrans", hint: "définitions `*_setting.cfg.bin`" },
	{ kind: "layer", label: "Calques", hint: "couches composant les écrans" },
	{ kind: "objbin", label: "Objets de menu", hint: "fichiers `.objbin`" },
	{ kind: "g4pkm", label: "Packs de matériaux", hint: "fichiers `.g4pkm`" },
	{ kind: "g4tx", label: "Textures", hint: "fichiers `.g4tx`" },
	{ kind: "component", label: "Composants", hint: "classes RTTI du binaire" },
	{ kind: "lua", label: "Scripts", hint: "bytecode `.lua.bin`" },
];

/** Lit le catalogue, ou `null` si l'export n'a pas encore été produit sur cette machine. */
async function lireCatalogue(): Promise<Mode[] | null> {
	try {
		const brut = await fs.readFile(CATALOGUE, "utf8");
		const parsed = JSON.parse(brut) as { modes?: Mode[] };
		return parsed.modes ?? [];
	} catch {
		return null;
	}
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
	const { path: segments } = await params;
	const slug = segments?.[0];
	if (!slug) {
		return {
			title: "Modes de jeu",
			description: "Les modes d'Inazuma Eleven: Victory Road, et les fichiers dont ils sont faits.",
		};
	}
	const modes = await lireCatalogue();
	const mode = modes?.find((m) => m.slug === slug);
	return {
		title: mode ? `${mode.label} — mode de jeu` : "Mode inconnu",
		description: mode?.note ?? undefined,
	};
}

export default async function PageModes({
	params,
}: {
	params: Promise<{ path?: string[] }>;
}) {
	const { path: segments } = await params;
	const slug = segments?.[0];
	const modes = await lireCatalogue();

	if (modes === null) {
		return (
			<div className="space-y-6">
				<MediaHeader
					active="/mode"
					title="Modes de jeu"
					description="Les modes du menu principal, et les fichiers dont ils sont faits."
				/>
				<MediaEmpty>
					Catalogue absent de cette machine. Il se produit avec <code>niers mode index</code> puis{" "}
					<code>niers mode export -o data/modes.json</code>.
				</MediaEmpty>
			</div>
		);
	}

	// ── Fiche d'un mode ────────────────────────────────────────────────────────
	if (slug) {
		const mode = modes.find((m) => m.slug === slug);
		if (!mode) {
			return (
				<div className="space-y-6">
					<MediaBack href="/mode" label="Tous les modes" />
					<MediaEmpty>Aucun mode ne porte l’identifiant « {slug} ».</MediaEmpty>
				</div>
			);
		}
		const familles = FAMILLES.map((f) => ({
			...f,
			entrees: f.kind === "screen" ? mode.screens.map((s) => s.screen) : (mode.assets[f.kind] ?? []),
		}));
		return (
			<div className="space-y-6">
				<MediaBack href="/mode" label="Tous les modes" />
				<header className="space-y-1">
					<h1 className="text-fluid-headline-md font-extrabold text-on-surface">{mode.label}</h1>
					{mode.labelEn || mode.labelJa ? (
						<p className="text-sm text-on-surface-variant">
							{[mode.labelEn, mode.labelJa].filter(Boolean).join(" · ")}
						</p>
					) : null}
					{mode.official ? (
						<p className="text-xs text-on-surface-variant">
							Mode énuméré par le jeu lui-même : <code>menu_text</code> porte un réglage audio à son
							nom.
						</p>
					) : null}
					<p className="max-w-3xl text-sm text-on-surface-variant">{mode.note}</p>
				</header>

				<MediaCount
					left={`${mode.counts.screens} écran${mode.counts.screens > 1 ? "s" : ""}`}
					right={`${mode.counts.layers} calques · ${mode.counts.focus} éléments focusables`}
				/>

				{mode.icon.region ? (
					<p className="text-sm text-on-surface-variant">
						Icône : région <code>{mode.icon.region}</code> de l’atlas <code>{mode.icon.atlas}</code>.
					</p>
				) : null}

				<div className="space-y-6">
					{familles.map((f) => (
						<section key={f.kind} className="space-y-2">
							<h2 className="text-sm font-semibold text-on-surface">
								{f.label}{" "}
								<span className="font-normal text-on-surface-variant">
									— {f.entrees.length} · {f.hint}
								</span>
							</h2>
							{f.entrees.length === 0 ? (
								<p className="text-sm text-on-surface-variant">
									Aucun fichier de cette famille pour ce mode.
								</p>
							) : (
								<ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
									{f.entrees.map((e) => (
										<li key={e} className="truncate font-mono text-xs text-on-surface-variant" title={e}>
											{e.split("/").pop()}
										</li>
									))}
								</ul>
							)}
						</section>
					))}
				</div>
			</div>
		);
	}

	// ── Liste des modes ────────────────────────────────────────────────────────
	const total = modes.reduce((n, m) => n + m.counts.screens, 0);
	const officiels = modes.filter((m) => m.official);
	const autres = modes.filter((m) => !m.official);

	const carte = (m: Mode) => {
		const textures = m.assets.g4tx?.length ?? 0;
		return (
			<li key={m.slug}>
				<Link
					href={`/mode/${m.slug}`}
					className="block rounded-lg border border-outline-variant p-4 transition hover:bg-surface-container"
				>
					<span className="block font-semibold text-on-surface">{m.label}</span>
					{m.labelJa ? (
						<span className="block text-xs text-on-surface-variant">{m.labelJa}</span>
					) : null}
					<span className="mt-1 block text-xs text-on-surface-variant">
						{m.counts.screens} écran{m.counts.screens > 1 ? "s" : ""} · {m.counts.layers} calques ·{" "}
						{textures} texture{textures > 1 ? "s" : ""}
					</span>
				</Link>
			</li>
		);
	};

	return (
		<div className="space-y-6">
			<MediaHeader
				active="/mode"
				title="Modes de jeu"
				description="Les modes du menu principal, et les fichiers dont ils sont faits. Les comptes sont mesurés sur le VFS du jeu."
			/>
			<MediaCount left={`${modes.length} modes`} right={`${total} écrans au total`} />

			<section className="space-y-2">
				<h2 className="text-sm font-semibold text-on-surface">
					Modes de jeu{" "}
					<span className="font-normal text-on-surface-variant">
						— {officiels.length}, énumérés par le jeu
					</span>
				</h2>
				<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{officiels.map(carte)}</ul>
			</section>

			<section className="space-y-2">
				<h2 className="text-sm font-semibold text-on-surface">
					Écrans du menu principal{" "}
					<span className="font-normal text-on-surface-variant">
						— {autres.length}, que le jeu ne compte pas parmi ses modes
					</span>
				</h2>
				<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{autres.map(carte)}</ul>
			</section>
		</div>
	);
}
