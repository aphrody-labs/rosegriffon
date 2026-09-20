"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { ResultatRecherche } from "@rosegriffon/search";

/**
 * Barre de recherche de l'accueil — les trois domaines, sans quitter la page.
 *
 * `@rosegriffon/search` portait déjà la requête unifiée (articles, wiki,
 * e-sport en un seul `UNION ALL`), testée, et n'était appelé nulle part : la
 * barre du chrome se contentait de rediriger vers `/search`, qui
 * réimplémentait sa propre recherche par domaine.
 *
 * Ici les résultats arrivent pendant la frappe. `Entrée` mène toujours à
 * `/search` pour la liste complète — la boîte de l'accueil montre les douze
 * premiers, pas tout.
 */

const DELAI_FRAPPE = 220;
const LONGUEUR_MINIMALE = 2;

const LIBELLE_DOMAINE: Record<string, string> = {
	association: "Association",
	esport: "E-sport",
	wiki: "Wiki",
};

export function RechercheUnifiee() {
	const [terme, setTerme] = useState("");
	const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
	const [cherche, setCherche] = useState(false);
	const champ = useRef<HTMLInputElement>(null);

	// Raccourci global : la barre est le point d'entrée de tout le site, elle
	// doit être atteignable sans souris depuis n'importe où sur la page.
	useEffect(() => {
		const auClavier = (evenement: KeyboardEvent) => {
			if ((evenement.metaKey || evenement.ctrlKey) && evenement.key.toLowerCase() === "k") {
				evenement.preventDefault();
				champ.current?.focus();
			}
		};
		globalThis.addEventListener("keydown", auClavier);
		return () => globalThis.removeEventListener("keydown", auClavier);
	}, []);

	useEffect(() => {
		const requete = terme.trim();
		if (requete.length < LONGUEUR_MINIMALE) {
			setResultats([]);
			setCherche(false);
			return;
		}

		// Une frappe en annule la précédente : sans ça, une réponse lente écrase
		// les résultats d'une frappe plus récente.
		const controleur = new AbortController();
		const minuterie = setTimeout(async () => {
			setCherche(true);
			try {
				const reponse = await fetch(`/api/recherche?q=${encodeURIComponent(requete)}`, {
					signal: controleur.signal,
				});
				if (!reponse.ok) return;
				const donnees = (await reponse.json()) as { resultats: ResultatRecherche[] };
				setResultats(donnees.resultats ?? []);
			} catch {
				// Abandon volontaire ou réseau indisponible : la boîte reste vide.
			} finally {
				setCherche(false);
			}
		}, DELAI_FRAPPE);

		return () => {
			controleur.abort();
			clearTimeout(minuterie);
		};
	}, [terme]);

	return (
		<div className="relative">
			<form action="/search" className="flex items-center gap-2">
				<input
					ref={champ}
					name="q"
					value={terme}
					onChange={(evenement) => setTerme(evenement.target.value)}
					placeholder="Chercher un joueur, une technique, un clan, un article…"
					aria-label="Recherche sur tout le site"
					className="h-11 w-full rounded-full border border-white/15 bg-black/30 px-5 text-sm text-white placeholder:text-white/40 backdrop-blur-xs focus:border-white/40 focus:outline-hidden"
				/>
			</form>

			{terme.trim().length >= LONGUEUR_MINIMALE && (
				<div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1730]/95 p-2 backdrop-blur-md">
					{resultats.length === 0 ? (
						<p className="px-3 py-4 text-center text-xs text-white/50">
							{cherche ? "Recherche…" : "Aucun résultat."}
						</p>
					) : (
						<ul className="flex flex-col">
							{resultats.map((resultat) => (
								<li key={`${resultat.domaine}-${resultat.id}`}>
									<Link
										href={resultat.href}
										className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/10"
									>
										<span className="truncate text-sm text-white">{resultat.titre}</span>
										<span className="shrink-0 text-[10px] uppercase tracking-wide text-white/40">
											{LIBELLE_DOMAINE[resultat.domaine] ?? resultat.domaine}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
