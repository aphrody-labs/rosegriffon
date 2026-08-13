/**
 * `/azalee` — les fiches de jeu d'Inazuma Eleven: Victory Road dans Discord.
 *
 * Ce fichier porte la RACINE `/azalee` et les cinq fiches historiques
 * (personnage, technique, objet, équipe, recherche transverse), reprises de
 * `commands/ievr.ts`. Les quatorze autres sous-commandes vivent dans
 * `commands/azalee-monde.ts` et se rattachent à la MÊME racine — le mécanisme
 * est expliqué en tête de ce dernier.
 *
 * Toute la lecture passe par `@rosegriffon/azalee` (client HTTP typé du
 * sous-chemin `/remote`, cf. `lib/azalee.ts` pour la raison de ne PAS ouvrir le
 * miroir SQLite depuis le bot).
 *
 * ⚠ PIÈGE `inagle_skills` : `category_id` et `element_id` sont à NULL en base.
 * Les filtres passent donc par les colonnes TEXTE françaises, via
 * `lib/ievr-labels.ts`. Une commande qui filtrerait sur l'identifiant ne
 * renverrait jamais rien. Vérifié sur les tables exposées ici : `inagle_teams`,
 * `inagle_items` et `inagle_characters` n'ont pas le même défaut (les filtres
 * `element`/`position` de `/api/characters` traduisent d'ailleurs eux-mêmes le
 * code anglais vers le texte français avant d'interroger la base).
 *
 * Les vues ci-dessous re-déclarent le strict nécessaire des réponses de l'API :
 * les types de `@rosegriffon/azalee/remote` sont dérivés des fonctions serveur
 * et exposent bien plus large que ce qu'un embed affiche.
 */
import { Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import {
	ApplicationCommandOptionType,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from "discord.js";

import { azalee, isAzaleeNotFound, messageErreurAzalee, urlWiki } from "../lib/azalee";
import {
	cheminCpkDepuisUrl,
	imageJeu,
	joindre,
	ligneStats,
	type Multilingue,
	nettoyerTexteJeu,
	type Statistiques,
	texteFr,
	urlModele3d,
	urlVisage,
} from "../lib/azalee-format";
import { cached } from "../lib/cache";
import { rgEmbed, truncate } from "../lib/embeds";
import {
	CATEGORIES_TECHNIQUE_FR,
	ELEMENTS_FR,
	iconeElementUrl,
	libelleCategorieObjet,
	RARETES_FR,
	resoudreCategorieTechnique,
	resoudreElement,
	resoudreRarete,
	suggerer,
} from "../lib/ievr-labels";

// --- Vues des réponses de l'API -------------------------------------------

interface TechniqueApprise {
	skillId?: string | null;
	learnLevel?: number | null;
}

interface VariantePerso {
	charaParamId?: string | null;
	internalCode?: string | null;
	position?: string | null;
	element?: string | null;
	rarity?: string | null;
	stats?: { lv99?: Statistiques | null } | null;
	skills?: TechniqueApprise[] | null;
	image?: string | null;
}

interface FichePerso {
	names?: Multilingue;
	descriptions?: Multilingue;
	variants?: VariantePerso[];
	bestRarity?: string | null;
	baseSlug?: string | null;
	slug?: string | null;
	teamId?: string | null;
	teamName?: string | null;
	series?: string | null;
	internalCode?: string | null;
	image?: string | null;
	constellation?: { index?: number | null; names?: Multilingue | null } | null;
}

interface FicheTechnique {
	skillId?: string | null;
	internalCode?: string | null;
	names?: Multilingue;
	descriptions?: Multilingue;
	displayName?: string | null;
	categoryName?: Multilingue | null;
	elementName?: Multilingue | null;
	skillType?: string | null;
	powerRange?: string | null;
	consumeTp?: number | null;
	recastTime?: number | null;
	growthSpeed?: string | null;
	videoUrl?: string | null;
	image?: string | null;
	shops?: { fr?: string[] | null } | null;
}

interface FicheObjet {
	itemId?: string | null;
	internalCode?: string | null;
	names?: Multilingue;
	descriptions?: Multilingue;
	category?: string | null;
	price?: number | null;
	stats?: Statistiques | null;
	shops?: { fr?: string[] | null } | null;
	image?: string | null;
}

interface EntreeEquipe {
	id?: string | null;
	name?: string | null;
	nameEn?: string | null;
	nameJa?: string | null;
	rosterCount?: number | null;
}

interface JoueurEffectif {
	name?: string | null;
	position?: string | null;
	element?: string | null;
}

interface FicheEquipe extends EntreeEquipe {
	descriptionFr?: string | null;
	descriptionEn?: string | null;
	emblemUrl?: string | null;
	seasons?: Record<string, number> | null;
	roster?: JoueurEffectif[] | null;
}

interface ResultatRecherche {
	characters?: FichePerso[];
	skills?: FicheTechnique[];
	items?: FicheObjet[];
}

// --- Socle partagé avec `azalee-monde.ts` ---------------------------------

/**
 * Réponse d'autocomplétion tolérante : une API muette ne doit pas figer la saisie.
 *
 * Discord n'accorde que 3 secondes ; au-delà, le champ reste bloqué sur
 * « chargement… ». On répond donc TOUJOURS, quitte à répondre une liste vide.
 */
export async function repondreSuggestions(
	interaction: AutocompleteInteraction,
	produire: () => Promise<Array<{ name: string; value: string }>>
): Promise<void> {
	try {
		const choix = await produire();
		await interaction.respond(
			choix
				.filter((c) => c.value.length > 0)
				.slice(0, 25)
				.map((c) => ({ name: truncate(c.name, 100), value: truncate(c.value, 100) }))
		);
	} catch {
		await interaction.respond([]);
	}
}

/** Saisie courante de l'option en cours d'autocomplétion. */
export function saisie(interaction: AutocompleteInteraction): string {
	const valeur = interaction.options.getFocused();
	return typeof valeur === "string" ? valeur : String(valeur ?? "");
}

/**
 * Ouvre une fiche par identifiant, avec REPLI PAR RECHERCHE sur le nom.
 *
 * L'autocomplétion Discord n'est qu'une suggestion : rien n'empêche de taper le
 * nom et de valider. Or `/api/characters/<id>` n'accepte qu'un slug — mesuré :
 * `perso « Mark Evans »` répondait « Introuvable dans le wiki » alors que
 * `?q=Mark Evans` renvoie exactement une ligne. Un membre qui écrit le vrai nom
 * d'un personnage ne doit pas s'entendre dire qu'il n'existe pas.
 *
 * L'ordre compte : l'identifiant d'abord (exact, une requête), la recherche
 * seulement en repli sur un 404 — jamais l'inverse, pour ne pas transformer un
 * slug valide en « meilleur résultat approchant ».
 */
export async function ouvrirFiche<T>(
	parIdentifiant: (cle: string) => Promise<T>,
	parRecherche: (texte: string) => Promise<string | null>,
	saisieBrute: string
): Promise<T> {
	try {
		return await parIdentifiant(saisieBrute);
	} catch (err) {
		if (!isAzaleeNotFound(err)) {
			throw err;
		}
		const cle = await parRecherche(saisieBrute);
		if (!cle) {
			throw err;
		}
		return await parIdentifiant(cle);
	}
}

/**
 * Illustration dont l'existence est PROUVÉE avant de la poser dans un embed.
 *
 * `imageJeu` répare les chemins hérités du dump, mais certaines URL restent
 * fausses au cas par cas (icône Miximax `iau0016a` absente des CPK, personnage
 * sans visage extrait…). Un embed Discord n'a pas d'`onError` : on demande donc
 * à l'index CPK — 250 800 fichiers, la même source que le décodeur du CDN — si
 * le fichier source existe, et on n'affiche rien sinon.
 *
 * Le verdict est mis en cache 6 h : l'index ne bouge qu'à une mise à jour du jeu.
 * Une URL hors CPK (portrait CloudFront) est renvoyée telle quelle, sans appel.
 */
export async function illustrationProuvee(
	url: string | null | undefined,
	largeur?: 200 | 400 | 800 | 1600
): Promise<string | null> {
	const image = imageJeu(url, largeur);
	if (!image) {
		return null;
	}
	const chemin = cheminCpkDepuisUrl(image);
	if (!chemin) {
		return image;
	}
	const existe = await cached<boolean>(`azalee:cpk:${chemin}`, 6 * 60 * 60_000, async () => {
		try {
			await azalee().cpkFile(chemin);
			return true;
		} catch {
			return false;
		}
	});
	return existe ? image : null;
}

/** Équipes du wiki, en cache court : 208 lignes, servies à chaque fiche de personnage. */
export async function equipesConnues(): Promise<EntreeEquipe[]> {
	return await cached<EntreeEquipe[]>("azalee:equipes", 10 * 60_000, async () => {
		const equipes = (await azalee().teams()) as unknown as EntreeEquipe[];
		return equipes.map((equipe) => ({
			id: equipe.id ?? null,
			name: equipe.name ?? null,
			nameEn: equipe.nameEn ?? null,
			nameJa: equipe.nameJa ?? null,
			rosterCount: equipe.rosterCount ?? null,
		}));
	});
}

/**
 * Nom d'équipe d'un personnage.
 *
 * `inagle_characters.teams` est NULL sur les 6 148 lignes, donc `teamName` que
 * renvoie l'API est TOUJOURS la chaîne vide — le champ « Équipe » ne pouvait
 * jamais s'afficher. `team_id`, lui, est peuplé et `/api/teams` résout les 208
 * noms : on fait la jointure ici.
 */
async function nomEquipe(perso: FichePerso): Promise<string | null> {
	const direct = perso.teamName?.trim();
	if (direct) {
		return direct;
	}
	if (!perso.teamId) {
		return null;
	}
	try {
		const equipes = await equipesConnues();
		const equipe = equipes.find((e) => String(e.id) === String(perso.teamId));
		return equipe?.name ?? equipe?.nameEn ?? null;
	} catch {
		// Une jointure décorative ne fait pas échouer une fiche.
		return null;
	}
}

/**
 * Somme des sept statistiques niveau 99 d'une variante — critère de « meilleure ».
 *
 * ⚠ `bestRarity` de l'API n'est PAS la meilleure variante : c'est la PLUS JEUNE
 * (`service.ts` → `youngest.rarity`). Mark Evans sortait ainsi en « Normal »
 * (Frappe 133) alors qu'il a des variantes bien supérieures. On classe donc sur
 * la donnée chiffrée, pas sur une étiquette.
 */
function totalStats(variante: VariantePerso): number {
	const stats = variante.stats?.lv99;
	if (!stats) {
		return -1;
	}
	return Object.values(stats).reduce<number>(
		(somme, valeur) => somme + (typeof valeur === "number" ? valeur : 0),
		0
	);
}

/** Nom français d'une technique apprise, résolu par son identifiant hexadécimal. */
async function nomTechnique(skillId: string): Promise<string | null> {
	return await cached<string | null>(`azalee:skill-nom:${skillId}`, 30 * 60_000, async () => {
		try {
			const technique = (await azalee().skill(skillId)) as unknown as FicheTechnique;
			return texteFr(technique.names, technique.displayName ?? "") || null;
		} catch {
			return null;
		}
	});
}

@Discord()
@SlashGroup({
	name: "azalee",
	description: "Encyclopédie du jeu Inazuma Eleven: Victory Road (wiki Azalée)",
})
@SlashGroup("azalee")
export class AzaleeJeuCommand {
	@Slash({
		name: "perso",
		description: "Fiche d'un personnage d'Inazuma Eleven: Victory Road : poste, élément, statistiques",
	})
	async perso(
		@SlashOption({
			name: "nom",
			description: "Nom du personnage",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: (interaction: AutocompleteInteraction) =>
				repondreSuggestions(interaction, async () => {
					const liste = await azalee().characters({
						q: saisie(interaction) || "a",
						limit: 25,
					} as never);
					return (liste.data as unknown as FichePerso[]).map((perso) => ({
						name: texteFr(perso.names),
						value: String(perso.baseSlug ?? perso.slug ?? ""),
					}));
				}),
		})
		nom: string,
		@SlashOption({
			name: "rarete",
			description: "Variante à afficher (par défaut : la plus forte)",
			type: ApplicationCommandOptionType.String,
			required: false,
			autocomplete: (interaction: AutocompleteInteraction) =>
				repondreSuggestions(interaction, async () =>
					suggerer(RARETES_FR, saisie(interaction)).map((r) => ({ name: r, value: r }))
				),
		})
		rarete: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const perso = await ouvrirFiche<FichePerso>(
				async (cle) => (await azalee().character(cle)) as unknown as FichePerso,
				async (texte) => {
					const liste = await azalee().characters({ q: texte, limit: 1 } as never);
					const trouve = (liste.data as unknown as FichePerso[])[0];
					return trouve ? String(trouve.baseSlug ?? trouve.slug ?? "") || null : null;
				},
				nom
			);

			const variantes = perso.variants ?? [];
			const rareteVoulue = resoudreRarete(rarete);
			const candidates = rareteVoulue
				? variantes.filter((v) => v.rarity === rareteVoulue)
				: variantes;
			// À défaut de variante de la rareté demandée, on montre quand même la
			// meilleure plutôt que de répondre « rien » sur un personnage qui existe.
			const retenues = candidates.length > 0 ? candidates : variantes;
			const meilleure =
				[...retenues].sort((a, b) => totalStats(b) - totalStats(a))[0] ?? ({} as VariantePerso);
			const slug = String(perso.baseSlug ?? perso.slug ?? nom);

			const embed = rgEmbed().setTitle(texteFr(perso.names)).setURL(urlWiki(`/chara/${slug}`));

			const resume = truncate(nettoyerTexteJeu(texteFr(perso.descriptions, "")), 400);
			if (resume.length > 0) {
				embed.setDescription(resume);
			}

			const identite = joindre([
				meilleure.position ? `Poste **${meilleure.position}**` : null,
				meilleure.element ? `Élément **${meilleure.element}**` : null,
				meilleure.rarity ? `Rareté **${meilleure.rarity}**` : null,
			]);
			if (identite.length > 0) {
				embed.addFields({ name: "Identité", value: identite });
			}

			const stats = ligneStats(meilleure.stats?.lv99);
			if (stats) {
				// L'embed dit de QUELLE variante viennent ces chiffres : un personnage
				// à neuf variantes n'a pas « des » statistiques, il en a neuf jeux.
				embed.addFields({
					name: `Statistiques niveau 99 — variante ${meilleure.rarity ?? "par défaut"}`,
					value: stats,
				});
			}

			const apprises = (meilleure.skills ?? []).filter(
				(s): s is TechniqueApprise & { skillId: string } => typeof s.skillId === "string"
			);
			if (apprises.length > 0) {
				const noms = await Promise.all(
					apprises.slice(0, 10).map(async (technique) => {
						const nomTech = await nomTechnique(technique.skillId);
						if (!nomTech) {
							return null;
						}
						return typeof technique.learnLevel === "number" && technique.learnLevel > 0
							? `Niv. ${technique.learnLevel} — ${nomTech}`
							: nomTech;
					})
				);
				const lignes = noms.filter((n): n is string => n !== null);
				if (lignes.length > 0) {
					embed.addFields({
						name: `Techniques apprises (${apprises.length})`,
						value: truncate(lignes.join("\n"), 1000),
					});
				}
			}

			const raretes = [...new Set(variantes.map((v) => v.rarity).filter(Boolean))];
			const equipe = await nomEquipe(perso);
			const contexte = joindre([
				equipe ? `Équipe **${equipe}**` : null,
				perso.series ? `Série **${perso.series}**` : null,
				perso.constellation?.names
					? `Signe **${texteFr(perso.constellation.names, "?")}**`
					: null,
				variantes.length > 1
					? `${variantes.length} variantes${raretes.length > 1 ? ` (${raretes.join(", ")})` : ""}`
					: null,
				perso.internalCode ? `Code \`${perso.internalCode}\`` : null,
			]);
			if (contexte.length > 0) {
				embed.addFields({ name: "Contexte", value: truncate(contexte, 1000) });
			}

			// Le portrait 256×256 vit dans les CPK ; `image_url` est vide en base pour
			// les personnages du jeu, on le dérive donc du code interne.
			const codeVisage = meilleure.internalCode ?? perso.internalCode;
			const portrait =
				(await illustrationProuvee(urlVisage(codeVisage), 200)) ??
				(await illustrationProuvee(meilleure.image ?? perso.image, 200)) ??
				iconeElementUrl(meilleure.element);
			if (portrait) {
				embed.setThumbnail(portrait);
			}

			const modele = urlModele3d(codeVisage ?? null);
			if (modele) {
				embed.addFields({ name: "Modèle 3D complet", value: modele });
			}
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messageErreurAzalee(err)}` });
		}
	}

	@Slash({ name: "technique", description: "Fiche d'une technique spéciale (hissatsu)" })
	async technique(
		@SlashOption({
			name: "nom",
			description: "Nom de la technique",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: (interaction: AutocompleteInteraction) =>
				repondreSuggestions(interaction, async () => {
					// Les filtres déjà saisis restreignent les propositions — traduits
					// en libellés FRANÇAIS, seuls exploitables par la base.
					const categorie = resoudreCategorieTechnique(interaction.options.getString("categorie"));
					const element = resoudreElement(interaction.options.getString("element"));
					const liste = await azalee().skills({
						q: saisie(interaction) || undefined,
						limit: 25,
						...(categorie ? { category: categorie } : {}),
						...(element ? { element } : {}),
					} as never);
					return (liste.data as unknown as FicheTechnique[]).map((technique) => {
						const etiquette = joindre([technique.categoryName?.fr, technique.elementName?.fr]);
						return {
							name: etiquette
								? `${texteFr(technique.names)} — ${etiquette}`
								: texteFr(technique.names),
							value: String(technique.skillId ?? technique.internalCode ?? ""),
						};
					});
				}),
		})
		nom: string,
		@SlashOption({
			name: "categorie",
			description: "Catégorie : Tir, Dribble, Défense, Arrêt",
			type: ApplicationCommandOptionType.String,
			required: false,
			autocomplete: (interaction: AutocompleteInteraction) =>
				repondreSuggestions(interaction, async () =>
					suggerer(CATEGORIES_TECHNIQUE_FR, saisie(interaction)).map((c) => ({ name: c, value: c }))
				),
		})
		_categorie: string | undefined,
		@SlashOption({
			name: "element",
			description: "Élément : Feu, Vent, Forêt, Montagne, Néant",
			type: ApplicationCommandOptionType.String,
			required: false,
			autocomplete: (interaction: AutocompleteInteraction) =>
				repondreSuggestions(interaction, async () =>
					suggerer(ELEMENTS_FR, saisie(interaction)).map((e) => ({ name: e, value: e }))
				),
		})
		_element: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const technique = await ouvrirFiche<FicheTechnique>(
				async (cle) => (await azalee().skill(cle)) as unknown as FicheTechnique,
				async (texte) => {
					const liste = await azalee().skills({ q: texte, limit: 1 } as never);
					const trouve = (liste.data as unknown as FicheTechnique[])[0];
					return trouve ? String(trouve.skillId ?? trouve.internalCode ?? "") || null : null;
				},
				nom
			);
			const embed = rgEmbed()
				.setTitle(texteFr(technique.names, technique.displayName ?? "Technique"))
				.setURL(urlWiki(`/skill/${encodeURIComponent(String(technique.skillId ?? nom))}`));

			const resume = truncate(nettoyerTexteJeu(texteFr(technique.descriptions, "")), 400);
			if (resume.length > 0) {
				embed.setDescription(resume);
			}

			const nature = joindre([
				technique.categoryName?.fr ? `Catégorie **${technique.categoryName.fr}**` : null,
				technique.elementName?.fr ? `Élément **${technique.elementName.fr}**` : null,
				technique.skillType ? `Type \`${technique.skillType}\`` : null,
			]);
			if (nature.length > 0) {
				embed.addFields({ name: "Nature", value: nature });
			}

			const chiffres = joindre([
				technique.powerRange ? `Puissance **${technique.powerRange}**` : null,
				typeof technique.consumeTp === "number" ? `Tension **${technique.consumeTp}**` : null,
				typeof technique.recastTime === "number" ? `Recharge **${technique.recastTime}**` : null,
				technique.growthSpeed ? `Croissance **${technique.growthSpeed}**` : null,
			]);
			if (chiffres.length > 0) {
				embed.addFields({ name: "Chiffres", value: chiffres });
			}
			const boutiques = technique.shops?.fr ?? [];
			if (boutiques.length > 0) {
				embed.addFields({ name: "En vente", value: truncate(boutiques.join(", "), 500) });
			}
			if (technique.videoUrl) {
				embed.addFields({ name: "Vidéo", value: truncate(technique.videoUrl, 500) });
			}

			// Le télop d'une technique est un bandeau 1728×352 (~330 Ko en PNG brut) :
			// on le demande en WebP w=800 au service de variantes.
			const illustration = await illustrationProuvee(technique.image, 800);
			if (illustration) {
				embed.setImage(illustration);
			}
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messageErreurAzalee(err)}` });
		}
	}

	@Slash({ name: "objet", description: "Fiche d'un objet : équipement, consommable, matériau…" })
	async objet(
		@SlashOption({
			name: "nom",
			description: "Nom de l'objet",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: (interaction: AutocompleteInteraction) =>
				repondreSuggestions(interaction, async () => {
					const liste = await azalee().items({
						q: saisie(interaction) || undefined,
						limit: 25,
					} as never);
					return (liste.data as unknown as FicheObjet[]).map((objet) => {
						const categorie = libelleCategorieObjet(objet.category);
						return {
							name: categorie ? `${texteFr(objet.names)} — ${categorie}` : texteFr(objet.names),
							value: String(objet.itemId ?? ""),
						};
					});
				}),
		})
		nom: string,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			// Même repli par recherche que les autres fiches : `/api/items/<id>`
			// n'accepte qu'un identifiant, or un membre tape le nom de l'objet.
			const objet = await ouvrirFiche<FicheObjet>(
				async (cle) => (await azalee().item(cle)) as unknown as FicheObjet,
				async (texte) => {
					const liste = await azalee().items({ q: texte, limit: 1 } as never);
					const trouve = (liste.data as unknown as FicheObjet[])[0];
					return trouve ? String(trouve.itemId ?? "") || null : null;
				},
				nom
			);
			const embed = rgEmbed()
				.setTitle(texteFr(objet.names))
				.setURL(urlWiki(`/item/${encodeURIComponent(String(objet.itemId ?? nom))}`));

			const resume = truncate(nettoyerTexteJeu(texteFr(objet.descriptions, "")), 400);
			if (resume.length > 0) {
				embed.setDescription(resume);
			}

			const fiche = joindre([
				// L'API sert l'identifiant du jeu (`craft_obj`) : une UI française
				// affiche « Matériau ».
				libelleCategorieObjet(objet.category)
					? `Catégorie **${libelleCategorieObjet(objet.category)}**`
					: null,
				typeof objet.price === "number"
					? `Prix **${objet.price.toLocaleString("fr-FR")}**`
					: null,
				objet.internalCode ? `Code \`${objet.internalCode}\`` : null,
			]);
			if (fiche.length > 0) {
				embed.addFields({ name: "Fiche", value: fiche });
			}

			const stats = ligneStats(objet.stats);
			if (stats) {
				embed.addFields({ name: "Bonus de statistiques", value: stats });
			}
			const boutiques = objet.shops?.fr ?? [];
			if (boutiques.length > 0) {
				embed.addFields({ name: "En vente", value: truncate(boutiques.join(", "), 500) });
			}

			// Les icônes d'objet sont des sous-textures d'atlas, non servies par le
			// CDN : `imageJeu` les refuse, l'embed reste propre au lieu d'afficher un
			// cadre cassé (c'était le cas dans `/ievr objet`).
			const illustration = await illustrationProuvee(objet.image, 200);
			if (illustration) {
				embed.setThumbnail(illustration);
			}
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messageErreurAzalee(err)}` });
		}
	}

	@Slash({ name: "equipe", description: "Fiche d'une équipe : emblème, séries, effectif" })
	async equipe(
		@SlashOption({
			name: "nom",
			description: "Nom de l'équipe",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: (interaction: AutocompleteInteraction) =>
				repondreSuggestions(interaction, async () => {
					const equipes = await equipesConnues();
					const aiguille = saisie(interaction).toLowerCase();
					return equipes
						.filter((equipe) =>
							aiguille.length === 0
								? true
								: `${equipe.name ?? ""} ${equipe.nameEn ?? ""} ${equipe.nameJa ?? ""}`
										.toLowerCase()
										.includes(aiguille)
						)
						.slice(0, 25)
						.map((equipe) => ({
							name: `${equipe.name ?? equipe.nameEn ?? "Équipe"} (${equipe.rosterCount ?? 0} joueurs)`,
							value: String(equipe.id ?? ""),
						}));
				}),
		})
		nom: string,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const equipe = (await azalee().team(nom)) as unknown as FicheEquipe;
			const effectif = equipe.roster ?? [];
			const embed = rgEmbed()
				.setTitle(String(equipe.name ?? equipe.nameEn ?? "Équipe"))
				.setURL(urlWiki(`/equipe/${encodeURIComponent(String(equipe.id ?? nom))}`));

			const resume = truncate(
				nettoyerTexteJeu(String(equipe.descriptionFr ?? equipe.descriptionEn ?? "")),
				400
			);
			if (resume.length > 0) {
				embed.setDescription(resume);
			}
			const autresNoms = joindre([equipe.nameEn, equipe.nameJa]);
			if (autresNoms.length > 0) {
				embed.addFields({ name: "Autres noms", value: truncate(autresNoms, 500) });
			}
			const series = Object.entries(equipe.seasons ?? {})
				.map(([clef, n]) => `${clef} (${n})`)
				.join(" · ");
			if (series.length > 0) {
				embed.addFields({ name: "Présences par série", value: truncate(series, 500) });
			}
			if (effectif.length > 0) {
				const apercu = effectif
					.slice(0, 12)
					.map((joueur) => `${joueur.name} — ${joueur.position ?? "?"} · ${joueur.element ?? "?"}`)
					.join("\n");
				embed.addFields({ name: `Effectif (${effectif.length})`, value: truncate(apercu, 900) });
			}
			const embleme = await illustrationProuvee(equipe.emblemUrl, 200);
			if (embleme) {
				embed.setThumbnail(embleme);
			}
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messageErreurAzalee(err)}` });
		}
	}

	@Slash({
		name: "recherche",
		description: "Cherche partout : personnages, techniques et objets d'un coup",
	})
	async recherche(
		@SlashOption({
			name: "texte",
			description: "Ce que tu cherches",
			type: ApplicationCommandOptionType.String,
			required: true,
			minLength: 2,
		})
		texte: string,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const resultat = (await azalee().search({
				q: texte,
				limit: 8,
			})) as unknown as ResultatRecherche;
			const embed = rgEmbed()
				.setTitle(`Recherche « ${truncate(texte, 60)} »`)
				.setURL(urlWiki(`/search?q=${encodeURIComponent(texte)}`));

			const sections: Array<{ titre: string; lignes: string[] }> = [
				{
					titre: "Personnages",
					lignes: (resultat.characters ?? []).map(
						(perso) => `[${texteFr(perso.names)}](${urlWiki(`/chara/${perso.baseSlug ?? perso.slug}`)})`
					),
				},
				{
					titre: "Techniques",
					lignes: (resultat.skills ?? []).map(
						(technique) =>
							`[${texteFr(technique.names)}](${urlWiki(
								`/skill/${encodeURIComponent(String(technique.skillId))}`
							)})`
					),
				},
				{
					titre: "Objets",
					lignes: (resultat.items ?? []).map(
						(objet) =>
							`[${texteFr(objet.names)}](${urlWiki(`/item/${encodeURIComponent(String(objet.itemId))}`)})`
					),
				},
			];

			const remplies = sections.filter((section) => section.lignes.length > 0);
			if (remplies.length === 0) {
				await interaction.editReply({
					content: `Aucun résultat pour « ${truncate(texte, 80)} ».`,
				});
				return;
			}
			for (const section of remplies) {
				embed.addFields({
					name: `${section.titre} (${section.lignes.length})`,
					value: truncate(section.lignes.join("\n"), 900),
				});
			}
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messageErreurAzalee(err)}` });
		}
	}
}
