"use client";

// Vue robuste d'un écran de menu IEVR.
//
// Rendu par défaut = le PNG du compositeur Rust (`nie-model-serve` → CDN `/menu-render`),
// servi pleine largeur en ratio 1280×720. C'est l'idiome « le menu est réécrit en Rust » :
// le rendu serveur est déterministe et ne dépend pas de WebGPU/navigateur (l'ancienne page
// montait directement le renderer WebGPU sur des layouts dégénérés → écran noir).
//
// Le rendu interactif WebGPU (MenuClient) reste disponible derrière un toggle, sans être
// monté par défaut (lazy : importé seulement si l'utilisateur l'active).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import type { MenuLayout } from "@rose-griffon/menu-render-webgpu";
import { isMenuScreenRuntimeEmpty, menuRenderPngUrl } from "../_layouts/render";

// Le toggle WebGPU charge MenuClient à la demande (évite d'embarquer le renderer dans le
// bundle initial de la page). MenuClient est `"use client"` + `next/dynamic ssr:false`.
const MenuClient = dynamic(() => import("./MenuClient").then((m) => m.MenuClient), {
	ssr: false,
	loading: () => (
		<div className="flex aspect-[16/9] w-full items-center justify-center bg-black text-sm text-white/60">
			Chargement du rendu interactif…
		</div>
	),
});

export function MenuScreenView({
	layout,
	screens,
}: {
	layout: MenuLayout;
	screens: readonly string[];
}) {
	const screen = layout.screen;
	const [interactive, setInteractive] = useState(false);
	const runtimeEmpty = isMenuScreenRuntimeEmpty(screen);

	const index = screens.indexOf(screen);
	const prev = index > 0 ? screens[index - 1] : screens[screens.length - 1];
	const next = index < screens.length - 1 ? screens[index + 1] : screens[0];

	return (
		<div className="space-y-6 pb-20" role="main" aria-label={`Écran de menu ${screen}`}>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="space-y-1">
					<p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
						Menu IEVR — rendu serveur
					</p>
					<h1 className="font-display text-3xl font-extrabold tracking-tight text-on-surface">
						{screen}
					</h1>
				</div>
				<button
					type="button"
					onClick={() => setInteractive((v) => !v)}
					aria-pressed={interactive}
					className="rounded-full border border-outline-variant/50 bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
				>
					{interactive ? "Rendu serveur (PNG)" : "Rendu interactif (WebGPU)"}
				</button>
			</div>

			<div className="overflow-hidden rounded-2xl border border-outline-variant/20 bg-black shadow-lg">
				<div className="relative aspect-[16/9] w-full">
					{interactive ? (
						<MenuClientFrame layout={layout} />
					) : (
						// PNG immuable cache-busté par version. `next/image` est inutile ici (asset
						// déjà optimisé côté CDN, ratio fixe) → `<img>` direct, sans /_next/image.
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={menuRenderPngUrl(screen)}
							alt={`Rendu de l'écran de menu IEVR « ${screen} »`}
							width={1280}
							height={720}
							className="absolute inset-0 h-full w-full object-contain"
							loading="eager"
							decoding="async"
						/>
					)}
				</div>
			</div>

			{!interactive && runtimeEmpty && (
				<p className="rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
					Cet écran est rendu vide côté serveur : son contenu est instancié au moment de
					l'exécution dans le jeu (écran de texte, modèles de listes ou éléments hors-canvas
					dans la pose de référence). Ce n'est pas une erreur de rendu.
				</p>
			)}

			<nav
				className="flex items-center justify-between gap-4"
				aria-label="Navigation entre écrans de menu"
			>
				<Link
					href={`/menu/${prev}`}
					className="rounded-full border border-outline-variant/50 bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
					rel="prev"
				>
					← {prev}
				</Link>
				<span className="text-xs text-on-surface-variant">
					{index + 1} / {screens.length}
				</span>
				<Link
					href={`/menu/${next}`}
					className="rounded-full border border-outline-variant/50 bg-surface-container-high px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
					rel="next"
				>
					{next} →
				</Link>
			</nav>

			<div className="flex flex-wrap gap-2" aria-label="Liste des écrans de menu">
				{screens.map((id) => (
					<Link
						key={id}
						href={`/menu/${id}`}
						aria-current={id === screen ? "page" : undefined}
						className={
							id === screen
								? "rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary"
								: "rounded-md bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
						}
					>
						{id}
					</Link>
				))}
			</div>
		</div>
	);
}

// Le renderer WebGPU est conçu en plein écran (`position: fixed`). Ici on veut le confiner
// dans le cadre 16/9 → on l'isole dans un conteneur relatif et on le positionne en absolu.
function MenuClientFrame({ layout }: { layout: MenuLayout }) {
	return (
		<div className="absolute inset-0">
			<MenuClient layout={layout} />
		</div>
	);
}
