/**
 * Navigateur de l'index CPK — route catch-all qui MIROITE l'arbre des fichiers
 * IEVR (250 800 entrées, source Redis db3 `iev:file:index`, matérialisée en
 * SQLite via `lib/cpk/index.ts`).
 *
 *   /cpk                         → racine (common/ + dx11/, avec comptes).
 *   /cpk/common                  → sous-dossiers de common (event, text, chr…).
 *   /cpk/common/chr/_face/...    → descend l'arbre.
 *   /cpk/dx11/menu/.../c.g4tx    → fiche fichier (preview selon le type).
 *
 * Server Component (lit le SQLite miroir, `import "server-only"` côté lib) ; les
 * composants interactifs (recherche, viewer 3D) sont des îlots `"use client"`
 * qui n'importent que le `-shared` client-safe. `force-dynamic` (catch-all, pas
 * de prerender de 250k chemins).
 *
 * Le path alias `@/*` mappe `./src/*` ET la racine `./*` ; les libs vivent à
 * `lib/cpk/*` (racine).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { CpkDirBrowser } from "@/app/cpk/CpkDirBrowser";
import { CpkFilePreview } from "@/app/cpk/CpkFilePreview";
import { fileMeta, listDirPaged } from "@/lib/cpk/index";
import { normalizeDir, segLabel, topLabel } from "@/lib/cpk/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 200;

/** Reconstitue le chemin d'index (`data/...`) depuis les segments d'URL. */
function indexPathFromSegments(segments: string[] | undefined): string {
	const rel = (segments ?? []).map((s) => decodeURIComponent(s)).join("/");
	if (rel === "" || rel === "data") return "data";
	return rel.startsWith("data/") ? rel : `data/${rel}`;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
	const { path } = await params;
	const indexPath = indexPathFromSegments(path);
	const rel = indexPath.replace(/^data\/?/, "");
	const last = rel.split("/").filter(Boolean).pop();
	const title = last ? segLabel(last) : "Fichiers CPK";
	return {
		alternates: { canonical: `/cpk${rel ? `/${rel}` : ""}` },
		description:
			"Navigateur complet des archives CPK d'Inazuma Eleven: Victory Road — textures, modèles 3D, sons, vidéos et données de jeu, décodés à la volée par le CDN.",
		title: `${title} | Fichiers CPK · Inazuma Eleven Victory Road - Azalée`,
	};
}

export default async function CpkPage({
	params,
	searchParams,
}: {
	params: Promise<{ path?: string[] }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { path } = await params;
	const sp = await searchParams;
	const indexPath = indexPathFromSegments(path);

	if (indexPath.includes("..")) {
		notFound();
	}

	// Un chemin peut être un FICHIER (feuille de l'index) ou un RÉPERTOIRE.
	const meta = indexPath === "data" ? null : fileMeta(indexPath);
	const segments = indexPath.replace(/^data\/?/, "").split("/").filter(Boolean);

	if (meta) {
		return (
			<div className="space-y-6">
				<Breadcrumb segments={segments} leafIsFile />
				<header className="space-y-1">
					<h1 className="text-fluid-headline-md font-extrabold text-on-surface font-mono break-all">
						{meta.name}
					</h1>
				</header>
				<CpkFilePreview
					name={meta.name}
					ext={meta.ext}
					path={meta.path}
					cpk={meta.cpk}
					kind={meta.kind}
					assetUrl={meta.assetUrl}
					thumbUrl={meta.thumbUrl}
				/>
			</div>
		);
	}

	// Répertoire : listing paginé (sous-dossiers complets + page de fichiers).
	const pageParam = typeof sp.p === "string" ? Number.parseInt(sp.p, 10) : 1;
	const pageNum = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
	const offset = (pageNum - 1) * PAGE_SIZE;
	const listing = listDirPaged(indexPath, PAGE_SIZE, offset);

	// Chemin inexistant (ni fichier ni répertoire peuplé) → 404, sauf racine.
	if (
		indexPath !== "data" &&
		listing.dirs.length === 0 &&
		listing.fileTotal === 0
	) {
		notFound();
	}

	const isRoot = normalizeDir(indexPath) === "data";

	return (
		<div className="space-y-6">
			<Breadcrumb segments={segments} />

			<header className="space-y-2">
				<h1 className="text-fluid-headline-lg font-extrabold text-on-surface">
					{isRoot
						? "Fichiers du jeu (CPK)"
						: segLabel(segments[segments.length - 1] ?? "")}
				</h1>
				<p className="text-on-surface-variant max-w-2xl">
					{isRoot
						? "Navigateur complet des archives CPK d'Inazuma Eleven: Victory Road. Parcourez les textures, modèles 3D, sons, vidéos et données — décodés à la volée par le CDN."
						: `Contenu de ${segments.join("/")}.`}
				</p>
			</header>

			<CpkDirBrowser
				dir={listing.dir}
				dirs={listing.dirs}
				files={listing.files}
				fileTotal={listing.fileTotal}
				fileOffset={listing.fileOffset}
				pageSize={PAGE_SIZE}
			/>
		</div>
	);
}

/** Fil d'Ariane : racine `/cpk` + chaque segment cliquable jusqu'au courant. */
function Breadcrumb({
	segments,
	leafIsFile = false,
}: {
	segments: string[];
	leafIsFile?: boolean;
}) {
	const crumbs = segments.map((seg, i) => {
		const href = `/cpk/${segments.slice(0, i + 1).join("/")}`;
		const isLast = i === segments.length - 1;
		const label = i === 0 ? topLabel(seg) : segLabel(seg);
		return { href, label, isLast, seg };
	});

	return (
		<nav
			aria-label="Fil d'Ariane"
			className="flex flex-wrap items-center gap-1 text-sm text-on-surface-variant"
		>
			<Link
				href="/cpk"
				className="inline-flex items-center gap-1 hover:text-primary transition font-medium"
			>
				<Icon name="database" size={16} /> CPK
			</Link>
			{crumbs.map((c) => (
				<span key={c.href} className="inline-flex items-center gap-1">
					<Icon name="chevron_right" size={14} className="text-on-surface-variant/40" />
					{c.isLast ? (
						<span
							className={`font-semibold text-on-surface ${leafIsFile ? "font-mono text-xs break-all" : ""}`}
						>
							{leafIsFile ? c.seg : c.label}
						</span>
					) : (
						<Link href={c.href} className="hover:text-primary transition">
							{c.label}
						</Link>
					)}
				</span>
			))}
		</nav>
	);
}
