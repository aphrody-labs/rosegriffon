export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { KeshinModelGallery } from "@/components/wiki/KeshinModelGallery";
import { wikiService } from "@/lib/wiki-service";

export const metadata: Metadata = {
	alternates: { canonical: "/keshin" },
	description:
		"Modèles 3D des Esprits Guerriers (Keshin) et de leurs armures d'Inazuma Eleven: Victory Road, assemblés depuis les données du jeu.",
	openGraph: {
		description:
			"Explorez les modèles 3D complets des Esprits Guerriers et de leurs armures d'Inazuma Eleven: Victory Road.",
		locale: "fr_FR",
		siteName: "Azalée - Inazuma Eleven Victory Road",
		title: "Modèles 3D — Esprits Guerriers & Armures | Azalée",
		type: "website",
		url: "/keshin",
	},
	title: "Modèles 3D — Esprits Guerriers & Armures - Azalée",
};

export default async function KeshinModelsPage() {
	const { keshin, armures } = await wikiService.getKeshinModelGallery();

	return (
		<div className="w-full space-y-8">
			<div>
				<h1 className="type-headline-small text-on-surface">Esprits Guerriers &amp; Armures</h1>
				<p className="type-body-medium text-on-surface-variant mt-1">
					Modèles 3D complets assemblés depuis les données du jeu (corps, armure et textures).
				</p>
			</div>

			<KeshinModelGallery keshin={keshin} armures={armures} />
		</div>
	);
}
