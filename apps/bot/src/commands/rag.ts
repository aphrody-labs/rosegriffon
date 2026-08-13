/**
 * `/rag` — le corpus indexé du projet, depuis Discord.
 *
 * ── CE QU'IL Y A DERRIÈRE ──────────────────────────────────────────────────
 * Deux index, deux services, deux usages qui se complètent :
 *
 *  1. `rag-api.service` (:8806) — recherche SÉMANTIQUE hybride sur ~65 000
 *     fragments : scripts Lua du jeu, `cfg.bin` convertis, exports JSON, code
 *     TypeScript du dépôt, fiches du wiki, publications X archivées, docs,
 *     texte du jeu. Dense (cosinus sur vecteurs e5-small) ∥ lexical (FTS5
 *     bm25), fusionnés par RRF. On y pose une QUESTION, pas un mot-clé.
 *  2. L'index de TEXTE DU JEU de l'API Azalée (`/api/text*`, :8807) — une
 *     recherche exacte (`LIKE`) sur les chaînes du jeu, avec l'identifiant de
 *     hachage qui permet de retrouver la même chaîne dans les trois langues.
 *     C'est l'outil du traducteur, là où le premier est l'outil du chercheur.
 *
 * `corpus` ne fait qu'une chose : dire l'état RÉEL de ces deux index. Aucun
 * chiffre n'y est estimé — et là où l'API ne permet pas de conclure, la commande
 * le dit au lieu d'inventer (cf. `SondeType` dans `lib/rag-format.ts`).
 *
 * Toute la mise en forme vit dans `lib/rag-format.ts`, pure et testée : ici, il
 * ne reste que l'appel réseau et l'assemblage de l'embed.
 */
import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";

import { azalee, isAzaleeNotFound, messageErreurAzalee } from "../lib/azalee";
import { cached } from "../lib/cache";
import { rgEmbed } from "../lib/embeds";
import {
	blocSondes,
	bornerEntier,
	champsRecherheTexte,
	champsTexteMultilingue,
	construireChampsResultats,
	dateFr,
	descriptionRecherche,
	estIdentifiantTexte,
	estTypeRag,
	K_MAX_RAG,
	LIBELLE_LANGUE,
	LIBELLE_TYPE,
	LIMITES_EMBED,
	longueurExtrait,
	nombreFr,
	NOMBRE_MAX_RESULTATS,
	normaliserIdentifiantTexte,
	normaliserRequete,
	requeteValide,
	resumerCategoriesTexte,
	tronquer,
	TYPES_RAG,
	type EntreeTexte,
	type LangueTexte,
	type ReponseRag,
	type SanteRag,
	type SondeType,
	type StatCategorieTexte,
	type TexteMultilingue,
	type TypeRag,
} from "../lib/rag-format";
import { appelService, ServiceIndisponibleError } from "../lib/services";

/**
 * Marge réservée hors champs dans le budget de 6 000 caractères : le pied de
 * page de `rgEmbed()`, plus la phrase qui annonce les résultats écartés.
 */
const MARGE_EMBED = 240;

/**
 * Délai d'expiration d'une recherche.
 *
 * Plus généreux que les 8 s par défaut : chaque requête est d'abord VECTORISÉE
 * par le sidecar d'embedding local, puis confrontée aux ~65 000 vecteurs du
 * store. C'est le seul appel du bot dont le coût dépend de la taille du corpus.
 */
const DELAI_RECHERCHE_MS = 15_000;

/**
 * Emplacements possibles de l'index sémantique sur disque, dans l'ordre de
 * préférence. Sert UNIQUEMENT à dater sa dernière écriture : `rag-api` n'expose
 * pas cette information, et une date inventée serait pire que pas de date.
 *
 * Le fichier `-wal` peut être plus récent que la base elle-même (une ingestion
 * qui n'a pas encore été repliée) : on retient la date la plus récente des deux.
 */
const CHEMINS_INDEX: readonly string[] = [
	Bun.env.RAG_STORE_PATH,
	"/home/ubuntu/rg/apps/azalee/data/rag/rag-store.sqlite",
]
	.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
	.map((c) => c.trim());

/** Date de dernière écriture de l'index, ou `null` si le fichier est hors de portée. */
async function derniereEcritureIndex(): Promise<Date | null> {
	for (const chemin of CHEMINS_INDEX) {
		let plusRecent = 0;
		for (const candidat of [chemin, `${chemin}-wal`]) {
			try {
				const fichier = Bun.file(candidat);
				// ⚠ `lastModified` d'un fichier absent rend une valeur absurde :
				// l'existence se vérifie AVANT de lire l'horodatage.
				if (await fichier.exists()) {
					plusRecent = Math.max(plusRecent, fichier.lastModified);
				}
			} catch {
				// Un index illisible n'est pas une panne de la commande.
			}
		}
		if (plusRecent > 0) {
			return new Date(plusRecent);
		}
	}
	return null;
}

/** Une recherche dans le corpus sémantique, mise en cache court. */
async function rechercher(requete: string, k: number, type: TypeRag | null): Promise<ReponseRag> {
	const clef = `rag:search:${type ?? "tous"}:${k}:${requete.toLowerCase()}`;
	return await cached<ReponseRag>(clef, 5 * 60_000, async () =>
		appelService<ReponseRag>("rag", "/search", {
			corps: { query: requete, k, ...(type ? { kinds: [type] } : {}) },
			delaiMs: DELAI_RECHERCHE_MS,
			tentatives: 2,
		})
	);
}

/**
 * Sonde un type de source.
 *
 * Voir `SondeType` : à `k = 50`, un nombre de résultats INFÉRIEUR au plafond est
 * le compte exact du type, parce que le moteur dense parcourt tous les fragments
 * du type avant de tronquer. C'est le seul décompte par type démontrable sans
 * ouvrir la base.
 */
async function sonderType(type: TypeRag): Promise<SondeType> {
	try {
		const reponse = await appelService<ReponseRag>("rag", "/search", {
			corps: { query: "corpus", k: K_MAX_RAG, kinds: [type] },
			delaiMs: DELAI_RECHERCHE_MS,
			tentatives: 1,
		});
		return { type, renvoyes: reponse.count, plafond: K_MAX_RAG };
	} catch {
		return { type, renvoyes: null, plafond: K_MAX_RAG };
	}
}

/** Message d'erreur lisible pour un salon, quelle que soit l'origine de la panne. */
function messageErreur(err: unknown): string {
	if (err instanceof ServiceIndisponibleError) {
		return err.messageLisible;
	}
	return messageErreurAzalee(err);
}

@Discord()
@SlashGroup({
	name: "rag",
	description: "Chercher dans le corpus indexé du projet : code, données de jeu, docs, archives",
})
@SlashGroup("rag")
export class RagCommand {
	@Slash({
		name: "question",
		description: "Poser une question en français au corpus indexé et en recevoir les extraits pertinents",
	})
	async question(
		@SlashOption({
			name: "question",
			description: "Votre question, en français (2 caractères minimum)",
			type: ApplicationCommandOptionType.String,
			required: true,
			minLength: 2,
			maxLength: 300,
		})
		questionBrute: string,
		@SlashChoice(
			...TYPES_RAG.map((type) => ({ name: `${LIBELLE_TYPE[type]} (${type})`, value: type as string }))
		)
		@SlashOption({
			name: "type",
			description: "Restreindre à un seul type de source",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		typeBrut: string | undefined,
		@SlashOption({
			name: "nombre",
			description: `Nombre d'extraits à afficher (1 à ${NOMBRE_MAX_RESULTATS}, 5 par défaut)`,
			type: ApplicationCommandOptionType.Integer,
			required: false,
			minValue: 1,
			maxValue: NOMBRE_MAX_RESULTATS,
		})
		nombreBrut: number | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();

		const requete = normaliserRequete(questionBrute);
		if (!requeteValide(requete)) {
			await interaction.editReply({ content: "❌ La question doit faire au moins 2 caractères." });
			return;
		}
		if (typeBrut !== undefined && !estTypeRag(typeBrut)) {
			await interaction.editReply({
				content: `❌ Type inconnu. Types acceptés : ${TYPES_RAG.map((t) => `\`${t}\``).join(", ")}.`,
			});
			return;
		}

		const type: TypeRag | null = estTypeRag(typeBrut) ? typeBrut : null;
		const nombre = bornerEntier(nombreBrut, 1, NOMBRE_MAX_RESULTATS, 5);

		try {
			const reponse = await rechercher(requete, nombre, type);

			const titre = tronquer(`Corpus — « ${requete} »`, LIMITES_EMBED.titre);
			const entete = descriptionRecherche(reponse, type);
			const budget = Math.max(0, LIMITES_EMBED.total - titre.length - entete.length - MARGE_EMBED);
			const { champs, ignores } = construireChampsResultats(
				reponse.results,
				budget,
				longueurExtrait(reponse.results.length)
			);

			const embed = rgEmbed().setTitle(titre);
			const notes = [entete];
			if (ignores > 0) {
				notes.push(
					`*${nombreFr(ignores)} extrait${ignores > 1 ? "s" : ""} de plus ${ignores > 1 ? "ont" : "a"} été écarté${ignores > 1 ? "s" : ""} : l'embed est plein. Relancez avec un \`nombre\` plus petit pour des extraits plus longs.*`
				);
			}
			if (reponse.count === 0) {
				notes.push("*Reformulez avec des mots du jeu (nom de personnage, de technique, de fichier) ou retirez le filtre `type`.*");
			}
			embed.setDescription(tronquer(notes.join("\n"), LIMITES_EMBED.description));
			if (champs.length > 0) {
				embed.addFields(champs);
			}

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messageErreur(err)}` });
		}
	}

	@Slash({
		name: "texte",
		description: "Chercher une chaîne du jeu, ou retrouver un identifiant de texte dans les trois langues",
	})
	async texte(
		@SlashOption({
			name: "recherche",
			description: "Un morceau de texte du jeu, ou un identifiant de hachage (ex. 0x11E1AD03)",
			type: ApplicationCommandOptionType.String,
			required: true,
			minLength: 2,
			maxLength: 200,
		})
		rechercheBrute: string,
		@SlashChoice(
			...(["fr", "en", "ja"] as const).map((langue) => ({ name: LIBELLE_LANGUE[langue], value: langue as string }))
		)
		@SlashOption({
			name: "langue",
			description: "Langue interrogée (français par défaut)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		langueBrute: string | undefined,
		@SlashOption({
			name: "nombre",
			description: `Nombre d'entrées à afficher (1 à ${NOMBRE_MAX_RESULTATS}, 10 par défaut)`,
			type: ApplicationCommandOptionType.Integer,
			required: false,
			minValue: 1,
			maxValue: NOMBRE_MAX_RESULTATS,
		})
		nombreBrut: number | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();

		const recherche = normaliserRequete(rechercheBrute);
		if (!requeteValide(recherche)) {
			await interaction.editReply({ content: "❌ La recherche doit faire au moins 2 caractères." });
			return;
		}
		const langue: LangueTexte = langueBrute === "en" || langueBrute === "ja" ? langueBrute : "fr";
		const nombre = bornerEntier(nombreBrut, 1, NOMBRE_MAX_RESULTATS, 10);

		try {
			// Un identifiant de hachage n'est pas une recherche : c'est une clé. On
			// rend alors la chaîne dans les TROIS langues d'un coup, ce que la
			// recherche par mot ne saurait pas faire.
			if (estIdentifiantTexte(recherche)) {
				const embed = await this.ficheTexte(recherche);
				if (embed) {
					await interaction.editReply({ embeds: [embed] });
					return;
				}
				// Sinon : ce n'était pas un identifiant connu, on cherche le mot.
			}

			const entrees = await cached<EntreeTexte[]>(
				`rag:texte:${langue}:${nombre}:${recherche.toLowerCase()}`,
				10 * 60_000,
				async () => (await azalee().text({ q: recherche, locale: langue, limit: nombre })) as EntreeTexte[]
			);

			const titre = tronquer(`Texte du jeu — « ${recherche} » en ${LIBELLE_LANGUE[langue]}`, LIMITES_EMBED.titre);
			const embed = rgEmbed().setTitle(titre);

			if (entrees.length === 0) {
				embed.setDescription(
					`Aucune chaîne du jeu ne contient « ${tronquer(recherche, 100)} » en ${LIBELLE_LANGUE[langue]}.\n*La recherche est exacte, sans correction d'orthographe : essayez une autre langue, ou \`/rag question\` pour une recherche par le sens.*`
				);
				await interaction.editReply({ embeds: [embed] });
				return;
			}

			const entete = `**${nombreFr(entrees.length)}** entrée${entrees.length > 1 ? "s" : ""} — les premières de l'index, correspondance exacte.`;
			const budget = Math.max(0, LIMITES_EMBED.total - titre.length - entete.length - MARGE_EMBED);
			const { champs, ignores } = champsRecherheTexte(entrees, budget);

			const notes = [entete, "*Reprenez un identifiant dans `/rag texte` pour lire la chaîne en français, anglais et japonais.*"];
			if (ignores > 0) {
				notes.push(`*${nombreFr(ignores)} entrée${ignores > 1 ? "s" : ""} écartée${ignores > 1 ? "s" : ""} faute de place.*`);
			}
			embed.setDescription(tronquer(notes.join("\n"), LIMITES_EMBED.description));
			embed.addFields(champs);

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messageErreur(err)}` });
		}
	}

	/**
	 * Fiche d'un identifiant de texte, dans les trois langues.
	 *
	 * Rend `null` quand l'identifiant n'existe pas : l'appelant retombe alors sur
	 * une recherche par mot, plutôt que d'annoncer « introuvable » à quelqu'un
	 * qui cherchait simplement un mot ressemblant à de l'hexadécimal.
	 */
	private async ficheTexte(saisie: string) {
		const identifiant = normaliserIdentifiantTexte(saisie);
		let entree: TexteMultilingue;
		try {
			entree = await cached<TexteMultilingue>(
				`rag:texte:hash:${identifiant}`,
				30 * 60_000,
				async () => (await azalee().textEntry(identifiant)) as TexteMultilingue
			);
		} catch (err) {
			if (isAzaleeNotFound(err)) {
				return null;
			}
			throw err;
		}

		const champs = champsTexteMultilingue(entree);
		if (champs.length === 0) {
			return null;
		}

		const embed = rgEmbed()
			.setTitle(`Texte du jeu — ${entree.hashId}`)
			.setDescription(
				entree.category
					? `Catégorie \`${entree.category}\` — la même chaîne dans les trois langues du jeu.`
					: "La même chaîne dans les trois langues du jeu."
			)
			.addFields(champs);
		return embed;
	}

	@Slash({
		name: "corpus",
		description: "État réel des deux index interrogeables : volume, répartition, dernière écriture",
	})
	async corpus(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply();

		try {
			const [sante, sondes, categories, ecriture] = await Promise.all([
				cached<SanteRag>("rag:sante", 60_000, async () => appelService<SanteRag>("rag", "/health")),
				cached<SondeType[]>("rag:sondes", 10 * 60_000, async () =>
					Promise.all(TYPES_RAG.map((type) => sonderType(type)))
				),
				cached<StatCategorieTexte[] | null>("rag:texte:stats", 30 * 60_000, async () => {
					try {
						return (await azalee().textStats()) as StatCategorieTexte[];
					} catch {
						// L'index de texte est un SECOND index : son absence ne doit pas
						// masquer l'état du premier.
						return null;
					}
				}),
				derniereEcritureIndex(),
			]);

			const embed = rgEmbed()
				.setTitle("État du corpus interrogeable")
				.setDescription(
					`Moteur **${sante.store}** — **${nombreFr(sante.chunks)}** fragments indexés, interrogeables par \`/rag question\`.`
				);

			embed.addFields({
				name: "Répartition par type de source",
				value: blocSondes(sondes),
			});

			embed.addFields({
				name: "Comment ces chiffres sont obtenus",
				value:
					`Sondage en direct, un par type, à \`k = ${K_MAX_RAG}\` — le plafond de l'API. ` +
					"En dessous du plafond le compte est **exact** (le moteur parcourt tous les fragments du type avant de tronquer) ; " +
					`au-delà, seul « ≥ ${nombreFr(K_MAX_RAG)} » est démontrable, aucune route n'exposant le décompte réel.`,
			});

			embed.addFields({
				name: "Dernière écriture de l'index",
				value:
					ecriture === null
						? "— *(fichier d'index hors de portée depuis cet hôte)*"
						: `${dateFr(ecriture)} *(heure de Paris)*`,
			});

			if (categories && categories.length > 0) {
				const resume = resumerCategoriesTexte(categories);
				embed.addFields({
					name: "Index du texte du jeu — `/rag texte`",
					value: tronquer(
						`**${nombreFr(resume.total)}** entrées en **français**, réparties en **${nombreFr(resume.categories)}** catégories.\n${resume.tete}`,
						LIMITES_EMBED.valeurChamp
					),
				});
			}

			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messageErreur(err)}` });
		}
	}
}
