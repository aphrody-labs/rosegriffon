import { NextResponse } from "next/server";

import { EMOTES } from "@/lib/emotes";

// Catalogue statique (change build-time uniquement).
export const revalidate = 86400;

export async function GET() {
	// Convertir l'objet EMOTES en tableau pour l'API
	const emotesList = Object.values(EMOTES).map((emote) => ({
		...emote,
		// Ajouter l'URL complète si nécessaire (ici on suppose que le client gère le domaine ou que c'est relatif)
		// Pour une API externe, il vaut mieux une URL absolue
		fullPath: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.rosegriffon.fr"}${emote.path}`,
	}));

	return NextResponse.json({
		success: true,
		count: emotesList.length,
		data: emotesList,
	});
}
