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
 *
 * Un second fichier, facultatif, porte le **contenu** de ces fichiers (`niers mode contenu
 * <slug>`) : les calques de chaque écran, les objets de menu parsés, les régions de chaque
 * texture et les messages localisés du mode. Quand il est là, la fiche ne se contente plus de
 * lister des noms de fichiers — elle montre ce qu'ils contiennent, images comprises.
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
	/**
	 * Libellés d'interface de l'écran, par locale — résolus depuis `menu_text` via le CRC-32
	 * que porte chaque slot de `MenuTextSetting`.
	 */
	texts?: Record<string, { obj: string; slot: string; text: string }[]>;
};

/**
 * Racine des données du jeu — même convention que le reste de l'app (`DATA_PATH`), pour qu'un
 * déplacement du dump ne demande pas de toucher au code.
 */
const CATALOGUE = path.join(process.env.DATA_PATH ?? "/home/ubuntu/niers/data", "modes.json");

/** Dossier des exports de contenu, un fichier par mode (`<slug>.json`). */
const CONTENUS = path.join(process.env.DATA_PATH ?? "/home/ubuntu/niers/data", "mode-contenu");

/** Le contenu des fichiers d'un mode, tel que l'exporte `niers mode contenu <slug>`. */
type Contenu = {
	slug: string;
	screens: { screen: string; cfg: string; octets: number; layers: string[]; focus: number }[];
	objbins: {
		path: string;
		octets: number;
		objet: {
			name: string;
			engine_type: string;
			g4pkm_path: string | null;
			g4tx_path: string | null;
			components: Record<string, { type_name: string }>[];
		};
	}[];
	textures: {
		path: string;
		catalogue: string;
		octets: number;
		textures: {
			id: number;
			nom: string;
			largeur: number;
			hauteur: number;
			dds: boolean;
			regions: { nom: string; x: number; y: number; w: number; h: number }[];
		}[];
	}[];
	lua: { path: string; octets: number }[];
	/** locale → clé de message → texte, résolu par CRC-32 depuis les tables du jeu. */
	messages: Record<string, Record<string, { texte: string; table: string }>>;
};

/**
 * Nom du PNG décodé d'une texture — même règle que `niers convert --toutes` :
 * `<fichier sans extension>__<nom de texture assaini>.png`.
 */
function fichierTexture(cheminG4tx: string, nomTexture: string): string {
	const base = cheminG4tx.split("/").pop() ?? cheminG4tx;
	const tronc = base.replace(/\.g4tx$/, "");
	const nom = nomTexture.replace(/[^A-Za-z0-9_-]/g, "_");
	return `${tronc}__${nom}.png`;
}

/** Les balises de mise en forme du jeu (`[CUP]`, `[$gaiji_x]`, `\n`) rendues lisibles. */
function texteLisible(brut: string): string {
	return brut
		.replaceAll("\\n", " ")
		.replace(/\[\$?[A-Za-z0-9_|]+\]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

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

/** Lit le contenu d'un mode, ou `null` s'il n'a pas encore été exporté. */
async function lireContenu(slug: string): Promise<Contenu | null> {
	// Le slug vient de l'URL : on refuse tout ce qui n'est pas un identifiant, plutôt que de
	// laisser un `../` remonter hors du dossier.
	if (!/^[a-z0-9-]+$/.test(slug)) return null;
	try {
		return JSON.parse(await fs.readFile(path.join(CONTENUS, `${slug}.json`), "utf8")) as Contenu;
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
		const contenu = await lireContenu(mode.slug);
		const messagesFr = Object.entries(contenu?.messages?.fr ?? {});
		const vignettes = (contenu?.textures ?? []).flatMap((g) =>
			g.textures
				.filter((t) => t.dds)
				.map((t) => ({
					src: `/api/mode-tex/${mode.slug}/${fichierTexture(g.path, t.nom)}`,
					nom: t.nom,
					largeur: t.largeur,
					hauteur: t.hauteur,
					regions: t.regions,
					fichier: g.path,
				})),
		);
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

				{(() => {
					const fr = mode.texts?.fr ?? [];
					// Les slots de guide de boutons (`<CMD_BACK|10>`) sont de l'UI de manette, pas des
					// libellés d'écran : on les compte à part plutôt que de les mêler aux vrais textes.
					const libelles = fr.filter((t) => !t.text.startsWith("<"));
					const guides = fr.length - libelles.length;
					return (
						<section className="space-y-2">
							<h2 className="text-sm font-semibold text-on-surface">
								Textes d’interface{" "}
								<span className="font-normal text-on-surface-variant">
									— {libelles.length} libellé{libelles.length > 1 ? "s" : ""}
									{guides > 0 ? ` · ${guides} guide${guides > 1 ? "s" : ""} de boutons` : ""}
								</span>
							</h2>
							{libelles.length === 0 ? (
								<p className="text-sm text-on-surface-variant">
									Aucun libellé d’interface résolu pour ce mode — ses écrans ne portent pas de slot
									de texte connu de <code>menu_text</code>.
								</p>
							) : (
								<ul className="space-y-1">
									{libelles.map((t) => (
										<li key={`${t.obj}/${t.slot}`} className="text-sm text-on-surface">
											{t.text.replaceAll("\\n", " ")}{" "}
											<span className="font-mono text-xs text-on-surface-variant">{t.slot}</span>
										</li>
									))}
								</ul>
							)}
						</section>
					);
				})()}

				{vignettes.length > 0 ? (
					<section className="space-y-2">
						<h2 className="text-sm font-semibold text-on-surface">
							Images{" "}
							<span className="font-normal text-on-surface-variant">
								— {vignettes.length} texture{vignettes.length > 1 ? "s" : ""} décodée
								{vignettes.length > 1 ? "s" : ""} depuis les <code>.g4tx</code> du mode
							</span>
						</h2>
						<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
							{vignettes.map((v) => (
								<li
									key={v.src}
									className="space-y-1 rounded-lg border border-outline-variant p-2"
								>
									{/* Damier : sans lui, une texture à fond transparent est invisible. */}
									<div
										className="flex items-center justify-center overflow-hidden rounded"
										style={{
											minHeight: "5rem",
											backgroundImage:
												"repeating-conic-gradient(rgb(0 0 0 / 0.08) 0% 25%, transparent 0% 50%)",
											backgroundSize: "16px 16px",
										}}
									>
										{/* biome-ignore lint/performance/noImgElement: PNG servi par notre route, hors pipeline next/image */}
										<img
											src={v.src}
											alt={v.nom}
											loading="lazy"
											className="max-h-40 max-w-full"
											style={{ imageRendering: v.largeur <= 256 ? "pixelated" : "auto" }}
										/>
									</div>
									<p className="truncate font-mono text-xs text-on-surface" title={v.nom}>
										{v.nom}
									</p>
									<p className="text-xs text-on-surface-variant">
										{v.largeur}×{v.hauteur}
										{v.regions.length > 1 ? ` · ${v.regions.length} régions` : ""}
									</p>
								</li>
							))}
						</ul>
					</section>
				) : null}

				{messagesFr.length > 0 ? (
					<section className="space-y-2">
						<h2 className="text-sm font-semibold text-on-surface">
							Messages du mode{" "}
							<span className="font-normal text-on-surface-variant">
								— {messagesFr.length}, résolus par CRC-32 depuis les tables du jeu
							</span>
						</h2>
						<p className="max-w-3xl text-sm text-on-surface-variant">
							Ces messages ne sont nommés que dans <code>nie.exe</code> ; les tables de texte n’en
							portent que le hash. Ce sont les phrases que le mode affiche réellement en jeu.
						</p>
						<ul className="space-y-1">
							{messagesFr.map(([cle, m]) => (
								<li key={cle} className="text-sm text-on-surface">
									{texteLisible(m.texte)}{" "}
									<span className="font-mono text-xs text-on-surface-variant">{cle}</span>
								</li>
							))}
						</ul>
					</section>
				) : null}

				{contenu ? (
					<section className="space-y-2">
						<h2 className="text-sm font-semibold text-on-surface">
							Écrans, en détail{" "}
							<span className="font-normal text-on-surface-variant">
								— les calques que chaque <code>*_setting.cfg.bin</code> déclare
							</span>
						</h2>
						<ul className="space-y-1">
							{contenu.screens.map((s) => (
								<li key={s.screen}>
									<details className="rounded-lg border border-outline-variant p-2">
										<summary className="cursor-pointer font-mono text-xs text-on-surface">
											{s.screen}{" "}
											<span className="text-on-surface-variant">
												— {s.layers.length} calques · {s.focus} focusables · {s.octets} o
											</span>
										</summary>
										<ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
											{s.layers.map((l) => (
												<li
													key={l}
													className="truncate font-mono text-xs text-on-surface-variant"
													title={l}
												>
													{l}
												</li>
											))}
										</ul>
									</details>
								</li>
							))}
						</ul>
					</section>
				) : null}

				{contenu ? (
					<section className="space-y-2">
						<h2 className="text-sm font-semibold text-on-surface">
							Objets de menu, en détail{" "}
							<span className="font-normal text-on-surface-variant">
								— {contenu.objbins.length} <code>.objbin</code> parsés, avec leurs composants
							</span>
						</h2>
						<ul className="space-y-1">
							{contenu.objbins.map((o) => (
								<li key={o.path}>
									<details className="rounded-lg border border-outline-variant p-2">
										<summary className="cursor-pointer font-mono text-xs text-on-surface">
											{o.objet.name}{" "}
											<span className="text-on-surface-variant">
												— {o.objet.components.length} composants · {o.octets} o
											</span>
										</summary>
										<div className="mt-2 space-y-1 text-xs text-on-surface-variant">
											{o.objet.g4pkm_path ? (
												<p className="truncate font-mono" title={o.objet.g4pkm_path}>
													pack : {o.objet.g4pkm_path}
												</p>
											) : null}
											{o.objet.g4tx_path ? (
												<p className="truncate font-mono" title={o.objet.g4tx_path}>
													texture : {o.objet.g4tx_path}
												</p>
											) : null}
											<p className="font-mono">
												{o.objet.components
													.map((c) => Object.values(c)[0]?.type_name)
													.filter(Boolean)
													.join(" · ")}
											</p>
										</div>
									</details>
								</li>
							))}
						</ul>
					</section>
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
