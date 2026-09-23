import { NextResponse } from "next/server";

import { grouperParDomaine, rechercherPartout } from "@rosegriffon/search";

import { getPgPool } from "@/lib/db/pg";

/**
 * Recherche unifiée — les trois domaines, une requête.
 *
 * `@rosegriffon/search` existait déjà, testé, avec sa requête `UNION ALL` sur
 * les articles, le wiki et l'e-sport… et n'était appelé par AUCUN fichier. La
 * page `/search` réimplémentait sa propre recherche par domaine, et la barre du
 * chrome se contentait de rediriger vers elle.
 *
 * Cette route est le point d'entrée manquant : elle sert la barre de l'accueil,
 * qui rend ses résultats pendant la frappe au lieu d'imposer un aller-retour de
 * page.
 *
 * La recherche traverse maintenant les DEUX mondes dans une seule requête SQL,
 * ce que la fusion des bases a rendu possible : `achillea.clan` et
 * `public.articles` sont dans le même `UNION ALL`.
 */
export const dynamic = "force-dynamic";

function rechercheIndisponible() {
	return NextResponse.json(
		{ erreur: "Recherche temporairement indisponible", groupes: [], resultats: [] },
		{ status: 503 }
	);
}

export async function GET(requete: Request) {
	const parametres = new URL(requete.url).searchParams;
	const terme = (parametres.get("q") ?? "").trim();

	if (terme.length < 2) {
		return NextResponse.json({ groupes: [], resultats: [] });
	}

	try {
		const pool = getPgPool();
		let queryFailed = false;
		const resultats = await rechercherPartout(
			async (sql, params) => {
				try {
					const { rows } = await pool.query(sql, params);
					return rows as never;
				} catch (erreur) {
					queryFailed = true;
					throw erreur;
				}
			},
			terme,
			{ limiteParSource: 4, limiteTotale: 12 }
		);
		if (queryFailed) return rechercheIndisponible();

		return NextResponse.json({
			groupes: grouperParDomaine(resultats),
			resultats,
		});
	} catch (erreur) {
		console.error("Erreur API recherche unifiée:", erreur);
		return rechercheIndisponible();
	}
}
