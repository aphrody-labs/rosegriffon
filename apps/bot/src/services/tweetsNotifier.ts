/**
 * Notification Discord des nouveaux tweets — le drain.
 *
 * ── QUI PUBLIE ─────────────────────────────────────────────────────────────
 * Le bot, et lui seul. `rg-cron.service` et `rg-bot.service` ouvrent une
 * passerelle Discord avec LE MÊME jeton : tout ce qui est fait des deux côtés
 * produit un doublon visible par les ~1984 membres. Le risque ne vient pourtant
 * pas de la passerelle mais du CURSEUR — la détection est une lecture de base,
 * pas un événement. Deux démons, deux curseurs, deux annonces. Il n'y a donc
 * qu'un curseur, et il appartient à celui qui publie.
 *
 * Le cron ne poste JAMAIS un tweet, même si le bot est injoignable : il
 * n'avance rien, le bot draine au réveil. Un repli « le cron poste si le bot est
 * down » recréerait le doublon au retour du bot.
 *
 * ── DEUX DÉCLENCHEURS, UNE SEULE VÉRITÉ ────────────────────────────────────
 *  1. `tweets.signal` poussé par le cron sur la socket UNIX — réactivité.
 *  2. un rattrapage toutes les 5 minutes — garantie.
 * Les deux drainent le MÊME curseur, donc les deux sont idempotents. C'est le
 * motif déjà en production pour la veille des messages Discord côté cron
 * (« Filet de sécurité du temps réel… ce rattrapage rejoue tout ce qui a été
 * manqué »).
 *
 * ── QUATRE VERROUS CONTRE LE REJEU ET LE DOUBLON ───────────────────────────
 *  1. curseur persisté en Postgres (`tweet_notification_curseurs`) ;
 *  2. première exécution : la ligne est créée à `now()` et rien n'est annoncé ;
 *  3. fenêtre de rattrapage (48 h, cf. `services/tweets.ts`) + plafond par
 *     exécution : rejouer l'archive est impossible même curseur corrompu ;
 *  4. échange-comparaison sur le curseur (`avancerCurseur`) + `enforceNonce`
 *     côté Discord : deux processus qui draineraient en même temps, ou un
 *     redémarrage tombé entre l'envoi et l'écriture du curseur, ne produisent
 *     pas deux annonces. Le booléen `drainEnCours` ne protège, lui, que d'un
 *     seul processus — il ne suffit pas.
 */
import type { Client, EmbedBuilder, SendableChannels } from "discord.js";

import { abonnerCron } from "../lib/cron-ipc";
import { rgEmbed } from "../lib/embeds";
import {
	corpsTweet,
	dateTweet,
	decouperEnLots,
	formaterMetriques,
	imagesTweet,
	nonceLot,
	resumeLot,
	tweetEstNotifiable,
	urlTweet,
	type FiltreTweets,
	type LigneTweet,
} from "../lib/tweets-format";
import {
	CANAL_NOTIFICATION,
	assurerCurseur,
	avancerCurseur,
	lireCurseur,
	lireFiltreNotification,
	tweetsAPublier,
} from "./tweets";

/** Rattrapage périodique — la garantie, indépendante de toute poussée. */
export const INTERVALLE_FILET_MS = 5 * 60_000;

/** Fenêtre d'agrégation après un signal : laisse le lot se constituer. */
const DELAI_APRES_SIGNAL_MS = 15_000;

export type EtatDrain =
	| "inactif"
	| "amorce"
	| "rien"
	| "publie"
	| "resume"
	| "sans-salon"
	| "concurrent"
	/** Le drain a levé : ce n'est PAS « rien à annoncer », et ça se dit. */
	| "echec";

export interface ResultatDrain {
	etat: EtatDrain;
	candidats: number;
	publies: number;
	detail?: string;
}

let drainEnCours = false;
let minuteurFilet: ReturnType<typeof setInterval> | null = null;
let minuteurSignal: ReturnType<typeof setTimeout> | null = null;
let couperAbonnement: (() => void) | null = null;

/** Embed d'un tweet : traduction en tête, lien vers l'original, image, métriques. */
export function embedTweet(tweet: LigneTweet): EmbedBuilder {
	const lien = urlTweet(tweet);
	const auteur = tweet.author_username ? `@${tweet.author_username}` : "compte inconnu";
	const embed = rgEmbed()
		.setAuthor({
			name: tweet.author_name ? `${tweet.author_name} (${auteur})` : auteur,
			url: `https://x.com/${tweet.author_username ?? "i"}`,
		})
		.setURL(lien)
		.setTitle(tweet.is_thread ? `Fil de ${tweet.tweet_count ?? 1} posts` : "Nouveau post");

	const corps = corpsTweet(tweet, 1_000);
	if (corps.length > 0) {
		embed.setDescription(corps);
	}

	const images = imagesTweet(tweet.media);
	if (images[0]) {
		embed.setImage(images[0].url);
	}

	const metriques = formaterMetriques(tweet.metrics);
	if (metriques) {
		embed.addFields({ name: "Portée", value: metriques, inline: false });
	}
	if (tweet.category) {
		embed.addFields({ name: "Catégorie", value: tweet.category, inline: true });
	}

	const date = dateTweet(tweet);
	if (date) {
		embed.setTimestamp(date);
	}
	return embed;
}

/** Embed de synthèse quand le lot dépasse `max_par_lot`. */
export function embedResume(tweets: LigneTweet[], filtre: FiltreTweets): EmbedBuilder {
	const dernier = tweets.at(-1);
	return rgEmbed()
		.setTitle("Veille X — nouveaux posts")
		.setDescription(
			`${resumeLot(tweets)}\n\nTrop de posts pour les détailler (seuil : ${filtre.max_par_lot}). ` +
				`Ouvre \`/tweets liste\` pour tout parcourir.`
		)
		.setURL(dernier ? urlTweet(dernier) : "https://x.com/inazuma_project");
}

/**
 * Résout le salon de destination, et dit POURQUOI quand ça échoue.
 *
 * Le cas mesuré n'est pas théorique : `DISCORD_NEWS_CHANNEL_ID` pointe sur un
 * salon dont `@everyone` est privé de `VIEW_CHANNEL` et où le rôle du bot n'a
 * pas été ajouté → l'API répond `50001 Missing Access`. Sans explication, le
 * symptôme se lit « la notification ne marche pas », alors que c'est un droit
 * Discord à donner au bot, pas une ligne de code à changer.
 */
export async function resoudreSalon(
	client: Client,
	salonId: string
): Promise<{ salon: SendableChannels | null; raison?: string }> {
	try {
		const salon = await client.channels.fetch(salonId);
		if (salon?.isSendable()) {
			return { salon };
		}
		const raison = `Le salon ${salonId} existe mais le bot ne peut pas y écrire (salon non textuel, ou permission « Envoyer des messages » absente).`;
		console.warn(`[tweets] ${raison}`);
		return { salon: null, raison };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const droits = /missing access|50001/i.test(message)
			? " — le bot ne voit pas ce salon : donne à son rôle la permission « Voir le salon » (et « Envoyer des messages ») dessus."
			: "";
		const raison = `Salon ${salonId} injoignable (${message})${droits}`;
		console.warn(`[tweets] ${raison}`);
		return { salon: null, raison };
	}
}

/**
 * Draine le curseur une fois. Idempotent : deux appels simultanés ne publient
 * jamais deux fois (garde `drainEnCours` + curseur avancé après l'envoi).
 *
 * @param options.salonForce salon de destination imposé (`/tweets test`).
 * @param options.simulation ne publie pas et n'avance PAS le curseur.
 */
export async function drainerTweets(
	client: Client,
	options: { salonForce?: string; simulation?: boolean } = {}
): Promise<ResultatDrain> {
	if (drainEnCours) {
		return { etat: "concurrent", candidats: 0, publies: 0 };
	}
	drainEnCours = true;
	try {
		const filtre = await lireFiltreNotification();
		if (!filtre.actif && !options.simulation) {
			return { etat: "inactif", candidats: 0, publies: 0 };
		}

		// ⚠ En simulation, AUCUNE écriture — pas même la création du curseur, qui
		// est une écriture de production : `/tweets test` affirme « le curseur n'a
		// pas bougé », cette affirmation doit rester vraie.
		const curseur = options.simulation
			? await lireCurseur(CANAL_NOTIFICATION)
			: await assurerCurseur(CANAL_NOTIFICATION);
		if (!curseur) {
			return {
				etat: "amorce",
				candidats: 0,
				publies: 0,
				detail:
					"Aucun curseur en base : il sera créé à `now()` au premier drain réel, sans rejouer l'archive.",
			};
		}
		if (curseur.cree) {
			return {
				etat: "amorce",
				candidats: 0,
				publies: 0,
				detail: `Curseur initialisé à ${curseur.curseurLe.toISOString()} — l'archive ne sera pas rejouée.`,
			};
		}

		const candidats = await tweetsAPublier(curseur, filtre);
		const retenus = candidats.filter((tweet) => tweetEstNotifiable(tweet, filtre));
		if (candidats.length === 0) {
			return { etat: "rien", candidats: 0, publies: 0 };
		}

		const salonId = options.salonForce ?? filtre.salon ?? Bun.env.DISCORD_NEWS_CHANNEL_ID ?? "";
		if (salonId.length === 0) {
			return {
				etat: "sans-salon",
				candidats: candidats.length,
				publies: 0,
				detail: "Aucun salon configuré (`settings['tweets.notification'].salon` ni `DISCORD_NEWS_CHANNEL_ID`).",
			};
		}
		const { salon, raison } = await resoudreSalon(client, salonId);
		if (!salon) {
			return {
				etat: "sans-salon",
				candidats: candidats.length,
				publies: 0,
				detail: raison ?? `Salon ${salonId} injoignable.`,
			};
		}

		const dernier = candidats.at(-1)!;
		const borneFinale = dateTweet(dernier) ?? new Date();
		// Le curseur avance sur TOUS les candidats, y compris ceux écartés par le
		// filtre : sinon un post filtré serait réexaminé à chaque drain, indéfiniment.
		let attendu = curseur.curseurLe;

		if (retenus.length === 0) {
			if (!options.simulation) {
				await avancerCurseur(CANAL_NOTIFICATION, attendu, borneFinale, dernier.id, 0);
			}
			return { etat: "rien", candidats: candidats.length, publies: 0 };
		}

		if (retenus.length > filtre.max_par_lot) {
			if (!options.simulation) {
				await salon.send({
					embeds: [embedResume(retenus, filtre)],
					enforceNonce: true,
					nonce: nonceLot(dernier.id),
				});
				await avancerCurseur(CANAL_NOTIFICATION, attendu, borneFinale, dernier.id, retenus.length);
			}
			return { etat: "resume", candidats: candidats.length, publies: retenus.length };
		}

		// ── Envoi détaillé, par TRANCHES ────────────────────────────────────────
		// Discord refuse un message de plus de 10 embeds ou de plus de 6 000
		// caractères cumulés, et le curseur n'avance qu'après un envoi réussi :
		// sans découpage, un lot un peu fourni bloquait la notification POUR
		// TOUJOURS (le même lot repartait toutes les 5 min en grossissant).
		const lots = decouperEnLots(retenus.map(embedTweet));
		let publies = 0;
		let index = 0;
		for (const lot of lots) {
			const consommes = publies + lot.length;
			const dernierDuLot = retenus[consommes - 1]!;
			const final = consommes >= retenus.length;
			// Le dernier lot consomme aussi les candidats filtrés qui suivent.
			const borne = final ? borneFinale : (dateTweet(dernierDuLot) ?? borneFinale);
			const idBorne = final ? dernier.id : dernierDuLot.id;

			if (!options.simulation) {
				// `enforceNonce` : Discord déduplique côté serveur si le même lot est
				// republié après un redémarrage tombé entre l'envoi et l'écriture du
				// curseur — la seule fenêtre de doublon qui restait.
				await salon.send({ embeds: lot, enforceNonce: true, nonce: nonceLot(idBorne, index) });
				const avance = await avancerCurseur(CANAL_NOTIFICATION, attendu, borne, idBorne, lot.length);
				if (!avance) {
					// Un autre drain a bougé le curseur pendant l'envoi : on s'arrête là
					// plutôt que d'écraser sa position et de tout ré-annoncer.
					console.warn(
						`[tweets] curseur déplacé par un autre drain — arrêt après ${consommes}/${retenus.length} posts.`
					);
					return { etat: "concurrent", candidats: candidats.length, publies: consommes };
				}
				attendu = borne;
			}
			publies = consommes;
			index += 1;
		}

		return { etat: "publie", candidats: candidats.length, publies };
	} catch (err) {
		console.error("[tweets] drain en échec :", err);
		return {
			etat: "echec",
			candidats: 0,
			publies: 0,
			detail: err instanceof Error ? err.message : String(err),
		};
	} finally {
		drainEnCours = false;
	}
}

/**
 * Démarre le notifieur : amorce du curseur, filet de 5 minutes, abonnement aux
 * poussées du cron. Renvoie la fonction d'arrêt.
 */
export function demarrerNotifieurTweets(client: Client): () => void {
	const drainer = (origine: string): void => {
		void (async () => {
			const resultat = await drainerTweets(client);
			// Un drain qui ne trouve rien est le cas nominal : le journaliser toutes
			// les 5 minutes noierait le journal du service. Un échec, un salon
			// injoignable ou une collision, eux, doivent laisser une trace.
			if (
				resultat.publies > 0 ||
				resultat.etat === "amorce" ||
				resultat.etat === "sans-salon" ||
				resultat.etat === "echec" ||
				resultat.etat === "concurrent"
			) {
				const detail = resultat.detail ? ` — ${resultat.detail}` : "";
				console.info(
					`[tweets] drain (${origine}) : ${resultat.etat}, ${resultat.publies}/${resultat.candidats}${detail}`
				);
			}
		})();
	};

	// Amorce immédiate : crée le curseur à `now()` si la table est vierge, pour
	// que le tout premier drain réel ne puisse jamais rattraper l'archive.
	drainer("démarrage");

	minuteurFilet = setInterval(() => drainer("filet"), INTERVALLE_FILET_MS);

	couperAbonnement = abonnerCron((evenement) => {
		// `task.done` est la réponse différée d'un `/cron lancer` : le pont ne sait
		// pas dans quel salon la commande a été tapée (et le jeton d'interaction
		// peut avoir expiré), donc le verdict va au journal, d'où `/cron statut` le
		// relit à la demande.
		if (evenement.event === "task.done") {
			const verdict = evenement.success ? "succès" : `échec — ${String(evenement.error ?? "?")}`;
			console.info(`[cron-ipc] tâche « ${String(evenement.nom)} » terminée : ${verdict} (${String(evenement.durationMs)} ms)`);
			return;
		}
		if (evenement.event !== "tweets.signal") {
			return;
		}
		// Le signal est une OPTIMISATION : on laisse le lot se constituer avant de
		// drainer, sinon une récolte qui écrit 245 lignes en une minute
		// déclencherait autant de drains d'un seul tweet.
		if (minuteurSignal) {
			return;
		}
		minuteurSignal = setTimeout(() => {
			minuteurSignal = null;
			drainer("signal");
		}, DELAI_APRES_SIGNAL_MS);
	});

	return () => {
		if (minuteurFilet) {
			clearInterval(minuteurFilet);
			minuteurFilet = null;
		}
		if (minuteurSignal) {
			clearTimeout(minuteurSignal);
			minuteurSignal = null;
		}
		couperAbonnement?.();
		couperAbonnement = null;
	};
}
