export const revalidate = 3600; // ISR : revalidation horaire (écrans read-only).
export const dynamicParams = false; // Liste d'écrans finie → 404 sur écran inconnu.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MENU_SCREEN_IDS, getMenuLayout } from "../_layouts";
import { MenuClient } from "./MenuClient";

export function generateStaticParams(): Array<{ screen: string }> {
	return MENU_SCREEN_IDS.map((screen) => ({ screen }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ screen: string }>;
}): Promise<Metadata> {
	const { screen } = await params;
	const layout = getMenuLayout(screen);
	if (!layout) {
		return { title: "Écran de menu introuvable" };
	}
	return {
		description: `Rendu WebGPU 2D de l'écran de menu IEVR « ${screen} ».`,
		title: `Menu IEVR — ${screen}`,
		// Favicon du vrai site officiel Inazuma Eleven: Victory Road (inazuma.jp/victory-road).
		icons: {
			icon: [
				{ url: "/ievr-favicon.ico", sizes: "any" },
				{ url: "/ievr-icon-192.png", type: "image/png", sizes: "192x192" },
			],
			apple: "/ievr-icon-192.png",
		},
	};
}

export default async function MenuScreenPage({
	params,
}: {
	params: Promise<{ screen: string }>;
}) {
	const { screen } = await params;
	const layout = getMenuLayout(screen);
	if (!layout) {
		notFound();
	}
	return <MenuClient layout={layout} />;
}
