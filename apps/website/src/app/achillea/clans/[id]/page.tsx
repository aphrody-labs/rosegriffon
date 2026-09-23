import type { Metadata } from "next";
import { metadonneesAchillea, resume } from "@/app/achillea/metadonnees";
import { getPublicClan } from "@/lib/achillea/unified-clans";
import ClanProfileClient from "./clan-profile-client";

/*
 * Page serveur : elle n'existe que pour porter les métadonnées, que
 * `"use client"` interdit. L'interface, inchangée, vit dans
 * `clan-profile-client.tsx`.
 *
 * Le titre est résolu côté serveur parce qu'un titre générique commun aux 42
 * fiches de clan ne vaudrait pas mieux que le titre unique qu'on vient de
 * supprimer : c'est exactement le même défaut, à une échelle plus petite.
 */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const numero = Number(id);
	const chemin = `/achillea/clans/${id}`;

	if (!Number.isSafeInteger(numero) || numero <= 0) {
		return metadonneesAchillea({
			titre: "Clan introuvable",
			description: "Ce clan Achilléa n'existe pas ou a été dissous.",
			chemin: null,
			indexable: false,
		});
	}

	let clan;
	try {
		clan = await getPublicClan(numero);
	} catch {
		return metadonneesAchillea({
			titre: "Fiche de clan",
			description: "Informations publiques d'un clan compétitif Achilléa.",
			chemin,
		});
	}

	return metadonneesAchillea({
		titre: `${clan.name} (${clan.shortName})`,
		description:
			resume(clan.biography) ??
			`Le clan ${clan.name} sur Achilléa : recrutement ${clan.isRecruiting ? "ouvert" : "fermé"}.`,
		chemin,
	});
}

export default async function ClanProfilePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return <ClanProfileClient id={id} />;
}
