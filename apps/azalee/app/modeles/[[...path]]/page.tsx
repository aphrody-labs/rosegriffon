/**
 * Le corpus 3D du jeu, en une seule page.
 *
 * Avant : `/modeles` servait techniques, objets et animaux **filtrés par un manifeste statique**
 * (509 codes) et `/keshin` les esprits et armures depuis le miroir — deux pages, deux sources,
 * une fraction du corpus. Mesuré sur le VFS et le miroir, le jeu compte **6 236 modèles** :
 * 5 526 personnages, 272 techniques, 247 objets, 100 esprits, 89 armures, 2 animaux.
 *
 * Trois vues, une route :
 *   /modeles                    les familles et leur volume
 *   /modeles/<famille>          la grille paginée des codes
 *   /modeles/<famille>/<code>   la fiche : modèle 3D assemblé live + ses textures
 *
 * Aucun gate statique. Ce qui existe dans le jeu est listé ; la route d'assemblage répond 404
 * pour ce qu'elle ne sait pas produire, et la fiche le dit — plutôt que d'enfermer le corpus
 * dans une liste écrite à la main qui vieillit en silence.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { MediaCount, MediaEmpty, MediaHeader } from "@/components/wiki/MediaShell";
import InlineModelViewer from "@/components/wiki/InlineModelViewer";
import { cpkExplorerHref, lsOrNull } from "@rosegriffon/azalee/cpk/live";
import { cpkThumbUrl } from "@rosegriffon/azalee/cpk/shared";
import {
	MODEL_FAMILIES,
	modelFamily,
	modelGlbUrl,
	modelHref,
	modelTextureDir,
	type ModelFamily,
} from "@rosegriffon/azalee/cpk/models";
import { modelesDe } from "@/lib/cpk/model-corpus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Codes par page — borne le poids du HTML sur une famille de 5 526 entrées. */
const PAR_PAGE = 120;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
	const { path } = await params;
	const [famille, code] = path ?? [];
	const def = famille ? modelFamily(famille) : undefined;
	const titre = code ? `${code} — ${def?.label ?? ""}` : (def?.label ?? "Tous les modèles");
	return {
		alternates: { canonical: `/modeles${path?.length ? `/${path.join("/")}` : ""}` },
		description: `Modèles 3D d'Inazuma Eleven: Victory Road assemblés live depuis les fichiers du jeu — ${titre}.`,
		title: `Modèles 3D — ${titre} | Azalée`,
	};
}

export default async function ModelesPage({
	params,
	searchParams,
}: {
	params: Promise<{ path?: string[] }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const [{ path }, sp] = await Promise.all([params, searchParams]);
	const segments = (path ?? []).filter((s) => s !== ".." && s !== ".");
	const [familleId, code] = segments;
	const def = familleId ? modelFamily(familleId) : undefined;

	if (familleId && !def) {
		return (
			<div className="w-full space-y-5">
				<EnTete titre="Modèles 3D" />
				<MediaEmpty>Famille de modèles inconnue : « {familleId} ».</MediaEmpty>
			</div>
		);
	}

	if (def && code) return <Fiche famille={def.id} code={code} />;
	if (def) {
		const pageParam = typeof sp.page === "string" ? Number.parseInt(sp.page, 10) : 1;
		const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
		return <Grille famille={def.id} page={page} />;
	}
	return <Familles />;
}

/** En-tête commun aux trois vues. */
function EnTete({ titre, description }: { titre: string; description?: string }) {
	return (
		<MediaHeader
			title={titre}
			active="/modeles"
			description={
				description ??
				"Tous les modèles 3D du jeu, assemblés à la volée depuis les fichiers d'origine (maillage, squelette et textures)."
			}
		/>
	);
}

/** Vue d'accueil : les familles et leur volume. */
async function Familles() {
	const comptes = await Promise.all(
		MODEL_FAMILIES.map(async (f) => (await modelesDe(f.id)).length),
	);
	const total = comptes.reduce((a, b) => a + b, 0);

	return (
		<div className="w-full space-y-5">
			<EnTete titre="Modèles 3D" />
			<MediaCount left={`${total.toLocaleString("fr")} modèles au total`} />
			<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{MODEL_FAMILIES.map((f, i) => (
					<li key={f.id}>
						<Link
							href={`/modeles/${f.id}`}
							className="block rounded-2xl border border-outline-variant bg-surface-container-low p-4 transition hover:border-primary/50 hover:bg-surface-container"
						>
							<span className="flex items-baseline justify-between gap-2">
								<span className="font-medium text-on-surface">{f.label}</span>
								<span className="tabular-nums text-sm text-on-surface-variant">
									{(comptes[i] ?? 0).toLocaleString("fr")}
								</span>
							</span>
							<span className="mt-0.5 block text-xs text-on-surface-variant">{f.hint}</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}

/** Grille paginée des codes d'une famille. */
async function Grille({ famille, page }: { famille: ModelFamily; page: number }) {
	const def = modelFamily(famille);
	const tous = await modelesDe(famille);
	const pages = Math.max(1, Math.ceil(tous.length / PAR_PAGE));
	const tranche = tous.slice((page - 1) * PAR_PAGE, page * PAR_PAGE);

	return (
		<div className="w-full space-y-5">
			<EnTete titre={`Modèles 3D — ${def?.label ?? famille}`} description={def?.hint} />
			<nav className="flex flex-wrap gap-2">
				<Link
					href="/modeles"
					className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-sm text-on-surface transition hover:border-primary/50"
				>
					↩ Toutes les familles
				</Link>
				{MODEL_FAMILIES.filter((f) => f.id !== famille).map((f) => (
					<Link
						key={f.id}
						href={`/modeles/${f.id}`}
						className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 text-sm text-on-surface-variant transition hover:border-primary/50 hover:text-on-surface"
					>
						{f.label}
					</Link>
				))}
			</nav>

			{tous.length === 0 ? (
				<MediaEmpty>
					Aucun modèle listé pour cette famille — la source est momentanément injoignable.
				</MediaEmpty>
			) : (
				<>
					<MediaCount
						left={`${tous.length.toLocaleString("fr")} modèle${tous.length > 1 ? "s" : ""}`}
						right={`Page ${page} sur ${pages}`}
					/>
					<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
						{tranche.map((m) => (
							<li key={m.code}>
								<Link
									href={modelHref(famille, m.code)}
									className="block rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 transition hover:border-primary/50 hover:bg-surface-container"
								>
									<span className="block truncate text-sm text-on-surface" title={m.name ?? m.code}>
										{m.name ?? m.code}
									</span>
									{m.name && (
										<span className="block truncate font-mono text-[10px] text-on-surface-variant">
											{m.code}
										</span>
									)}
								</Link>
							</li>
						))}
					</ul>
					{pages > 1 && (
						<nav className="flex items-center justify-center gap-3 pt-2 text-sm">
							{page > 1 && (
								<Link
									href={`/modeles/${famille}?page=${page - 1}`}
									className="rounded-full bg-surface-container px-4 py-2 text-on-surface transition hover:bg-surface-container-high"
								>
									Précédent
								</Link>
							)}
							<span className="text-on-surface-variant">
								{page} / {pages}
							</span>
							{page < pages && (
								<Link
									href={`/modeles/${famille}?page=${page + 1}`}
									className="rounded-full bg-surface-container px-4 py-2 text-on-surface transition hover:bg-surface-container-high"
								>
									Suivant
								</Link>
							)}
						</nav>
					)}
				</>
			)}
		</div>
	);
}

/** Fiche d'un modèle : le 3D assemblé, puis ses textures. */
async function Fiche({ famille, code }: { famille: ModelFamily; code: string }) {
	const def = modelFamily(famille);
	const [tous, texDir] = [await modelesDe(famille), modelTextureDir(famille, code)];
	const entree = tous.find((m) => m.code === code);
	// Les textures d'un personnage sont éclatées entre visage, uniforme et corps : pas de
	// dossier unique à lister, le GLB assemblé les porte déjà toutes.
	const textures = texDir ? ((await lsOrNull(texDir, 200))?.files ?? []) : [];
	const g4tx = textures.filter((f) => f.ext === "g4tx");

	return (
		<div className="w-full space-y-5">
			<EnTete
				titre={entree?.name ?? code}
				description={`${def?.label ?? famille} · code ${code} — modèle assemblé à la volée depuis les fichiers du jeu.`}
			/>

			<nav className="flex flex-wrap items-center gap-1 text-sm text-on-surface-variant">
				<Link href="/modeles" className="hover:text-primary">
					Modèles
				</Link>
				<span aria-hidden>›</span>
				<Link href={`/modeles/${famille}`} className="hover:text-primary">
					{def?.label ?? famille}
				</Link>
				<span aria-hidden>›</span>
				<span className="font-mono text-on-surface">{code}</span>
				{entree?.slug && (
					<>
						<span aria-hidden className="mx-1">
							·
						</span>
						<Link href={`/chara/${entree.slug}`} className="text-primary hover:underline">
							Fiche du personnage
						</Link>
					</>
				)}
			</nav>

			<div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low">
				<InlineModelViewer glbUrl={modelGlbUrl(famille, code)} name={entree?.name ?? code} />
			</div>

			<section className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
				<h2 className="mb-2 text-sm font-medium text-on-surface">Télécharger</h2>
				<a
					href={modelGlbUrl(famille, code)}
					download={`${code}.glb`}
					className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-3 py-1.5 text-xs text-on-surface transition hover:border-primary/50 hover:bg-surface-container-high"
				>
					<span className="font-medium uppercase">glb</span>
				</a>
				<p className="mt-2 text-xs text-on-surface-variant">
					glTF binaire — maillage, squelette et textures dans un seul fichier.
					{texDir && (
						<>
							{" "}
							<Link href={cpkExplorerHref(texDir)} className="text-primary hover:underline">
								Voir les fichiers d'origine dans l'explorateur CPK
							</Link>
						</>
					)}
				</p>
			</section>

			{g4tx.length > 0 && (
				<>
					<MediaCount
						left={`${g4tx.length.toLocaleString("fr")} fichier${
							g4tx.length > 1 ? "s" : ""
						} de texture`}
					/>
					<ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
						{g4tx.map((t) => (
							<li key={t.path}>
								<Link
									href={`/textures/${t.path.replace(/^data\/dx11\//, "")}`}
									className="group block overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container transition hover:border-primary/50"
								>
									<span className="flex aspect-square items-center justify-center bg-surface-container-high">
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={cpkThumbUrl(t.path, t.ext, 400) ?? ""}
											alt={t.name}
											loading="lazy"
											decoding="async"
											className="max-h-full max-w-full object-contain"
										/>
									</span>
									<span
										className="block truncate px-2 py-1.5 font-mono text-[11px] text-on-surface-variant group-hover:text-on-surface"
										title={t.name}
									>
										{t.name.replace(/\.g4tx$/i, "")}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	);
}
