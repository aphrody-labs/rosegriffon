import "server-only";

/**
 * VÉRIFICATION D'UNE PUBLICATION INSTAGRAM PAR L'oEMBED PUBLIC DE META.
 *
 * ── CE QUE ÇA FAIT, ET CE QUE ÇA NE FAIT PAS ───────────────────────────────
 * `graph.facebook.com/v23.0/instagram_oembed` est le DERNIER point d'entrée
 * Instagram qui réponde encore à un client non authentifié (mesuré le
 * 13/8/2026 : 200 sans jeton). Mais il a été vidé de sa substance — il ne rend
 * plus que `version, provider_name, provider_url, type, width, html`, et le
 * `html` est un `<blockquote>` dont le seul texte visible est « View this post
 * on Instagram ». Ni auteur, ni miniature, ni légende.
 *
 * Il ne sert donc PAS à récolter. Il sert à répondre à UNE question, et il y
 * répond de façon fiable et gratuite : **cette publication existe-t-elle et
 * est-elle publique ?**
 *   * 200                              -> oui
 *   * 400, code 24, subcode 2207045    -> « Media Not Found » : inexistante,
 *                                         supprimée, ou compte passé en privé
 *
 * C'est exactement la garde dont un formulaire de dépôt a besoin : elle empêche
 * qu'un lien inventé, une faute de frappe ou un post privé n'entre dans la
 * galerie publique.
 *
 * ── POURQUOI PAS DE SCRAPING À CÔTÉ ────────────────────────────────────────
 * À un client non connecté, Instagram sert désormais la même coquille SPA de
 * ~605 Ko pour tout — page de tag, page de post, page d'embed — SANS aucune
 * balise `og:`, sans JSON-LD, sans `window._sharedData` (vérifié sur le post
 * réel de la campagne). Il n'y a rien à en extraire : l'image et la légende
 * sont fournies par le déposant, pas devinées.
 */

import { verdictDepuisReponse, type VerificationInstagram } from "./oembed-shared";

export {
	verdictDepuisReponse,
	type VerificationInstagram,
	type VerdictPublication,
} from "./oembed-shared";

/** Point d'entrée oEmbed. Surchargeable pour pointer un miroir ou un bouchon. */
function baseOembed(): string {
	return process.env.INSTAGRAM_OEMBED_URL || "https://graph.facebook.com/v23.0/instagram_oembed";
}

/** Au-delà, on ne bloque pas le déposant : on conclut « indéterminée ». */
const DELAI_MS = 5000;

/**
 * Cette publication existe-t-elle et est-elle publique ?
 *
 * Ne lève jamais : une panne réseau rend `indeterminee`, pas une exception.
 */
export async function verifierPublication(permalien: string): Promise<VerificationInstagram> {
	const url = new URL(baseOembed());
	url.searchParams.set("url", permalien);
	// `omitscript` allège la réponse : on ne rend jamais le `html` de Meta au
	// navigateur (il embarquerait un script tiers dans nos pages).
	url.searchParams.set("omitscript", "true");

	try {
		const reponse = await fetch(url, { signal: AbortSignal.timeout(DELAI_MS) });
		const corps = await reponse.json().catch(() => null);
		return verdictDepuisReponse(reponse.status, corps);
	} catch {
		return {
			message:
				"Instagram n'a pas répondu ; ta création est enregistrée et sera vérifiée par l'équipe.",
			verdict: "indeterminee",
		};
	}
}
