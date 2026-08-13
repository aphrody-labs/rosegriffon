"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

import { decouperDuree, type DureeRestante } from "@/lib/x-campagnes/types";

/*
 * Compte à rebours d'une campagne — îlot client, forcément.
 *
 * ⚠ HYDRATATION. La page est `force-dynamic`, mais elle est quand même rendue
 * une première fois sur le serveur : afficher « il reste 9 j 21 h 04 min 12 s »
 * dès ce rendu-là produirait un HTML qui ne peut PAS correspondre au premier
 * rendu du navigateur (quelques centaines de millisecondes plus tard), et React
 * signalerait une divergence d'hydratation.
 *
 * D'où l'ordre choisi : le serveur ET le premier rendu client dessinent la MÊME
 * grille avec des tirets, l'effet la remplit après le montage. Même DOM, mêmes
 * dimensions — aucune divergence, aucun saut de mise en page.
 *
 * ⚠ FUSEAU. La cible est un instant absolu (`timestamptz` en base, ISO en
 * props) : la soustraction `cible - maintenant` ne dépend d'aucun fuseau. Seule
 * l'ÉCHÉANCE lisible en dépend, et elle est formatée en heure de Paris par
 * `formaterDateHeureParis()` — côté serveur, une fois, donc identique partout.
 *
 * ⚠ PASSAGE À ZÉRO. `decouperDuree()` plancher à 0, la minuterie est arrêtée au
 * franchissement et le libellé bascule. Pas de compteur qui repart en négatif,
 * pas d'intervalle qui tourne pour rien jusqu'à la fin de la visite.
 */

/**
 * Une case du compte à rebours. Le libellé s'accorde tout seul.
 *
 * ⚠ QUATRE COLONNES SOUS 640 px, C'EST ~33 px DE TEXTE PAR CASE. « secondes »
 * en réclame 48 : le libellé partait donc en « seco… » entre 375 et 479 px —
 * précisément le format que la DA vise. Aucune taille de police ne rattrape
 * l'écart, et couper un mot de huit lettres pour en montrer quatre n'informe
 * personne. La case porte donc DEUX libellés : l'abréviation française usuelle
 * (« j », « h », « min », « s ») tant que la place manque, le mot entier dès
 * `sm`. Pas de coût pour les lecteurs d'écran : la grille est `aria-hidden`,
 * l'échéance en clair vit sous elle.
 */
function Case({
	valeur,
	singulier,
	pluriel,
	abrege,
}: {
	valeur: number | null;
	singulier: string;
	pluriel: string;
	abrege: string;
}) {
	return (
		<div className="rounded-2xl border border-rg-or/40 bg-rg-sur-marine/10 px-2 py-2 text-center backdrop-blur-sm xs:px-3">
			<p className="text-fluid-headline-md font-bold leading-tight text-rg-sur-marine tabular-nums">
				{valeur === null ? "--" : String(valeur).padStart(2, "0")}
			</p>
			<p className="text-[0.65rem] leading-tight text-rg-sur-marine/80 xs:text-xs">
				<span className="sm:hidden">{abrege}</span>
				<span className="hidden sm:inline">
					{valeur !== null && valeur === 1 ? singulier : pluriel}
				</span>
			</p>
		</div>
	);
}

export function CompteARebours({
	cibleIso,
	libelle,
	libelleEcoule,
	echeance,
}: {
	/** Instant visé, en ISO 8601 (`fin_le` ou `debut_le` de la campagne). */
	cibleIso: string;
	/** Ce qu'on décompte, ex. « Fin de la campagne dans ». */
	libelle: string;
	/** Ce qu'on affiche une fois l'instant franchi, ex. « Campagne terminée ». */
	libelleEcoule: string;
	/** Échéance lisible, DÉJÀ formatée en heure de Paris par le serveur. */
	echeance: string;
}) {
	const [restant, setRestant] = useState<DureeRestante | null>(null);
	const [ecoule, setEcoule] = useState(false);

	useEffect(() => {
		const cible = new Date(cibleIso).getTime();
		if (Number.isNaN(cible)) {
			return;
		}
		/** Met à jour l'affichage ; renvoie `false` quand il n'y a plus rien à compter. */
		const battre = (): boolean => {
			const reste = cible - Date.now();
			if (reste <= 0) {
				setRestant(decouperDuree(0));
				setEcoule(true);
				return false;
			}
			setRestant(decouperDuree(reste));
			setEcoule(false);
			return true;
		};
		if (!battre()) {
			return;
		}
		const minuterie = setInterval(() => {
			if (!battre()) {
				clearInterval(minuterie);
			}
		}, 1000);
		return () => clearInterval(minuterie);
	}, [cibleIso]);

	return (
		<div className="mt-6 rounded-2xl border border-rg-or/40 bg-rg-sur-marine/5 p-4 backdrop-blur-sm">
			<div className="flex items-center gap-2">
				<Timer className="size-4 shrink-0 text-rg-or" aria-hidden />
				<p className="text-xs font-semibold uppercase tracking-wide text-rg-or">
					{ecoule ? libelleEcoule : libelle}
				</p>
			</div>

			{/* La grille chiffrée est décorative pour un lecteur d'écran : elle change
			    chaque seconde et serait insupportable à l'écoute. La phrase complète,
			    elle, est annoncée une fois, juste en dessous. */}
			{!ecoule && (
				<div className="mt-3 grid grid-cols-4 gap-2" aria-hidden>
					<Case valeur={restant?.jours ?? null} singulier="jour" pluriel="jours" abrege="j" />
					<Case valeur={restant?.heures ?? null} singulier="heure" pluriel="heures" abrege="h" />
					<Case
						valeur={restant?.minutes ?? null}
						singulier="minute"
						pluriel="minutes"
						abrege="min"
					/>
					<Case
						valeur={restant?.secondes ?? null}
						singulier="seconde"
						pluriel="secondes"
						abrege="s"
					/>
				</div>
			)}

			<p className="mt-3 text-sm text-rg-sur-marine/85">
				<time dateTime={cibleIso}>{echeance}</time>
			</p>
		</div>
	);
}
