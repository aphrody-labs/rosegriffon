import type { Metadata } from "next";
import { metadonneesAchillea, resume } from "@/app/achillea/metadonnees";
import { createAchilleaClient } from "@/lib/achillea";
import { signalerEchec } from "@/lib/achillea/signaler";
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
	const numero = Number.parseInt(id, 10);
	const chemin = `/achillea/clans/${id}`;

	if (!Number.isFinite(numero)) {
		return metadonneesAchillea({
			titre: "Clan introuvable",
			description: "Ce clan Achilléa n'existe pas ou a été dissous.",
			chemin: null,
			indexable: false,
		});
	}

	const resultat = await createAchilleaClient().clans.get(numero);
	if (!resultat.ok) {
		// Un titre de repli vaut mieux qu'une page sans métadonnées : la lecture
		// client réessaiera, et l'échec reste tracé dans les journaux.
		signalerEchec(`clans/${id} — métadonnées`, resultat);
		return metadonneesAchillea({
			titre: "Fiche de clan",
			description: "Composition, niveau et recrutement d'un clan compétitif Achilléa.",
			chemin,
		});
	}

	const clan = resultat.value;
	return metadonneesAchillea({
		titre: `${clan.name} (${clan.shortenedName})`,
		description:
			resume(clan.clanBiography) ??
			`Le clan ${clan.name} sur Achilléa : ${clan.membersCount} membre(s), niveau ${clan.experience.currentLevel}, recrutement ${clan.isRecruiting ? "ouvert" : "fermé"}.`,
		chemin,
		// Un clan dissous ou masqué reste consultable par lien direct, mais n'a
		// rien à faire dans un index public.
		indexable: !clan.isDisbanded && !clan.isHidden,
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
