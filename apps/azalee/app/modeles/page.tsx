export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { ChrModelGallery } from "@/components/wiki/ChrModelGallery";
import {
	type ChrModelSub,
	getChrModelGlbUrl,
	getChrModelTextureUrl,
	listServedChrModelCodes,
} from "@rose-griffon/azalee/images";
import { resolveModelCodeName } from "@/lib/wiki/game-text";

export const metadata: Metadata = {
	alternates: { canonical: "/modeles" },
	description:
		"Galerie 3D des modèles de techniques, objets et animaux d'Inazuma Eleven: Victory Road, assemblés live depuis les données du jeu (CPK).",
	openGraph: {
		description:
			"Explorez les modèles 3D des techniques, objets et animaux d'Inazuma Eleven: Victory Road.",
		locale: "fr_FR",
		siteName: "Azalée - Inazuma Eleven Victory Road",
		title: "Modèles 3D — Techniques, Objets & Animaux | Azalée",
		type: "website",
		url: "/modeles",
	},
	title: "Modèles 3D — Techniques, Objets & Animaux - Azalée",
};

/**
 * Construit les entrées (code + URL GLB + nom résolu) d'un sous-domaine chr
 * réellement servi. Le nom vient du mapping code-modèle → vrai nom décodé du jeu
 * (`data/chr-model-names.json`) ; repli sur le code pour les modèles décoratifs
 * sans entrée texte (props/parts/avatars de démo).
 */
function buildEntries(sub: ChrModelSub) {
	return listServedChrModelCodes(sub).flatMap((code) => {
		const glbUrl = getChrModelGlbUrl(sub, code);
		if (!glbUrl) return [];
		const { name } = resolveModelCodeName(code);
		return [{ code, glbUrl, name, textureUrl: getChrModelTextureUrl(sub, code) }];
	});
}

export default function ChrModelsPage() {
	const waza = buildEntries("waza");
	const item = buildEntries("item");
	const animal = buildEntries("animal");

	return (
		<div className="w-full space-y-8">
			<div>
				<h1 className="type-headline-small text-on-surface">Modèles 3D — chr</h1>
				<p className="type-body-medium text-on-surface-variant mt-1">
					Maillages 3D + textures des techniques, objets et animaux, assemblés live depuis les
					fichiers du jeu (CPK). Modèle (GLB) et texture (PNG) téléchargeables. Les codes sont
					les identifiants internes (events `common/chr/_waza`…).
				</p>
			</div>

			<ChrModelGallery waza={waza} item={item} animal={animal} />
		</div>
	);
}
