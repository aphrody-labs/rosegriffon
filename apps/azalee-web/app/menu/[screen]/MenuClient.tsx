"use client";

// Îlot client du rendu menu IEVR en WebGPU 2D.
//
// WebGPU n'existe que côté navigateur (`navigator.gpu` absent en SSR) ⇒ le renderer est monté
// via `next/dynamic` avec `ssr: false`. C'est l'idiome azalee pour tout composant navigateur
// lourd (cf. `app/tools/my-team/TeamBuilderLoader.tsx`). `dynamic(..., { ssr:false })` est
// interdit dans un Server Component → il DOIT vivre dans ce module `"use client"`.
//
// `GameMenuGpu` retombe automatiquement sur le `<GameMenu>` DOM si WebGPU est indisponible.

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import type { MenuLayout } from "@rose-griffon/menu-render-webgpu";

const GameMenuGpu = dynamic(
	() => import("@rose-griffon/menu-render-webgpu").then((m) => m.GameMenuGpu),
	{
		loading: () => <div style={{ background: "#000", inset: 0, position: "fixed" }} />,
		ssr: false,
	}
);

export function MenuClient({
	layout,
	style,
}: {
	layout: MenuLayout;
	// Par défaut le renderer remplit son conteneur (positionnement absolu, `inset: 0`). La page
	// `/menu/[screen]` le confine dans un cadre 16/9 ; un appelant plein écran peut passer
	// `{ position: "fixed" }`.
	style?: CSSProperties;
}) {
	// Base des assets PNG : `public/menu/...` (self, assetBase "") par défaut, ou un CDN dédié
	// via `NEXT_PUBLIC_MENU_ASSET_BASE` (couvert par la CSP `connect-src 'self' ${cdn}`).
	const assetBase = process.env.NEXT_PUBLIC_MENU_ASSET_BASE ?? "";

	return (
		<GameMenuGpu
			layout={layout}
			assetBase={assetBase}
			style={style ?? { inset: 0, position: "absolute" }}
		/>
	);
}
