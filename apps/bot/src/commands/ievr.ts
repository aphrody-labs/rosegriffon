/**
 * `/ievr` — les données de jeu d'Inazuma Eleven: Victory Road dans Discord.
 *
 * Toute la lecture passe par `@rosegriffon/azalee` (client HTTP typé du
 * sous-chemin `/remote`, cf. `lib/azalee.ts` pour la raison de ne PAS ouvrir le
 * miroir SQLite depuis le bot).
 *
 * ⚠ PIÈGE `inagle_skills` : `category_id` et `element_id` sont à NULL en base.
 * Les filtres passent donc par les colonnes TEXTE françaises, via
 * `lib/ievr-labels.ts`. Une commande qui filtrerait sur l'identifiant ne
 * renverrait jamais rien.
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

import { azalee, illustrationAbsolue, isAzaleeNotFound, messageErreurAzalee, urlWiki } from "../lib/azalee";
import { cached } from "../lib/cache";
import { rgEmbed, truncate } from "../lib/embeds";
import {
	CATEGORIES_TECHNIQUE_FR,
	ELEMENTS_FR,
	iconeElementUrl,
	libelleCategorieObjet,
	resoudreCategorieTechnique,
	resoudreElement,
	suggerer,
} from "../lib/ievr-labels";

interface Multilingue {
	fr?: string | null;
	en?: string | null;
	ja?: string | null;
}

interface Statistiques {
	kick?: number;
	control?: number;
	technique?: number;
	pressure?: number;
	physical?: number;
	agility?: number;
	intelligence?: number;
}

interface VariantePerso {
	position?: string | null;
	element?: string | null;
	rarity?: string | null;
	stats?: { lv99?: Statistiques | null } | null;
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

/** Libellés français des sept statistiques, alignés sur le wiki. */
const LIBELLES_STATS: Array<[keyof Statistiques, string]> = [
	["kick", "Frappe"],
	["control", "Contrôle"],
	["technique", "Technique"],
	["pressure", "Pression"],
	["physical", "Physique"],
	["agility", "Agilité"],
	["intelligence", "Intelligence"],
];

/** Réduit un objet multilingue à sa forme française, avec repli anglais puis japonais. */
function nomFr(noms: Multilingue | null | undefined, repli = "Inconnu"): string {
	for (const valeur of [noms?.fr, noms?.en, noms?.ja]) {
		if (typeof valeur === "string" && valeur.trim().length > 0) {
			return valeur.trim();
		}
	}
	return repli;
}

/** Bloc `Frappe 133 · Contrôle 146 · …`. */
function ligneStats(stats: Statistiques | null | undefined): string | null {
	if (!stats) {
		return null;
	}
	const morceaux = LIBELLES_STATS.map(([clef, libelle]) =>
		typeof stats[clef] === "number" ? `${libelle} **${stats[clef]}**` : null
	).filter((v): v is string => v !== null);
	return morceaux.length > 0 ? morceaux.join(" · ") : null;
}

/** Assemble une ligne `a · b · c` en ignorant les morceaux absents. */
function joindre(morceaux: Array<string | null | undefined>): string {
	return morceaux.filter((m): m is string => typeof m === "string" && m.length > 0).join(" · ");
}

/** Réponse d'autocomplétion tolérante : une API muette ne doit pas figer la saisie. */
async function repondreSuggestions(
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
		// Une autocomplétion qui lève laisse le champ bloqué sur « chargement… ».
		await interaction.respond([]);
	}
}

/** Saisie courante de l'option en cours d'autocomplétion. */
function saisie(interaction: AutocompleteInteraction): string {
	const valeur = interaction.options.getFocused();
	return typeof valeur === "string" ? valeur : String(valeur ?? "");
}

/**
 * Ouvre une fiche par identifiant, avec REPLI PAR RECHERCHE sur le nom.
 *
 * L'autocomplétion Discord n'est qu'une suggestion : rien n'empêche de taper le
 * nom et de valider. Or `/api/characters/<id>` n'accepte qu'un slug — mesuré :
 * `/ievr perso « Mark Evans »` répondait « Introuvable dans le wiki » alors que
 * `?q=Mark Evans` renvoie exactement une ligne. Un membre qui écrit le vrai nom
 * d'un personnage ne doit pas s'entendre dire qu'il n'existe pas.
 *
 * L'ordre compte : l'identifiant d'abord (exact, une requête), la recherche
 * seulement en repli sur un 404 — jamais l'inverse, pour ne pas transformer un
 * slug valide en « meilleur résultat approchant ».
 */
async function ouvrirFiche<T>(
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

/** Équipes du wiki, en cache court : 208 lignes, servies à chaque `/ievr perso`. */
async function equipesConnues(): Promise<EntreeEquipe[]> {
	return await cached<EntreeEquipe[]>("ievr:equipes", 10 * 60_000, async () => {
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
 * jamais s'afficher. `team_id`, lui, est peuplé (6 079/6 148) et `/api/teams`
 * résout les 208 noms : on fait la jointure ici.
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

@Discord()
@SlashGroup({ name: "ievr", description: "Données de jeu Inazuma Eleven: Victory Road (wiki Azalée)" })
@SlashGroup("ievr")
export class IevrCommand {
	@Slash({ name: "perso", description: "Fiche d'un personnage : poste, élément, statistiques" })
	async perso(
		@SlashOption({
			name: "nom",
			description: "Nom du personnage",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: (interaction: AutocompleteInteraction) =>
				repondreSuggestions(interaction, async () => {
					const liste = await azalee().characters({ q: saisie(interaction) || "a", limit: 25 } as never);
					return (liste.data as unknown as FichePerso[]).map((perso) => ({
						name: nomFr(perso.names),
						value: String(perso.baseSlug ?? perso.slug ?? ""),
					}));
				}),
		})
		nom: string,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const perso = (await ouvrirFiche<FichePerso>(
				async (cle) => (await azalee().character(cle)) as unknown as FichePerso,
				async (texte) => {
					const liste = await azalee().characters({ q: texte, limit: 1 } as never);
					const trouve = (liste.data as unknown as FichePerso[])[0];
					return trouve ? String(trouve.baseSlug ?? trouve.slug ?? "") || null : null;
				},
				nom
			)) as FichePerso;
			const variantes = perso.variants ?? [];
			const meilleure = variantes.find((v) => v.rarity === perso.bestRarity) ?? variantes[0] ?? {};
			const slug = String(perso.baseSlug ?? perso.slug ?? nom);

			const embed = rgEmbed()
				.setTitle(nomFr(perso.names))
				.setURL(urlWiki(`/chara/${slug}`));

			const resume = truncate(nomFr(perso.descriptions, "").replaceAll("\n", " "), 400);
			if (resume.length > 0) {
				embed.setDescription(resume);
			}

			const identite = joindre([
				meilleure.position ? `Poste **${meilleure.position}**` : null,
				meilleure.element ? `Élément **${meilleure.element}**` : null,
				perso.bestRarity ? `Rareté **${perso.bestRarity}**` : null,
			]);
			if (identite.length > 0) {
				embed.addFields({ name: "Identité", value: identite });
			}

			const stats = ligneStats(meilleure.stats?.lv99);
			if (stats) {
				// ⚠ `bestRarity` de l'API n'est PAS la meilleure variante : c'est la
				// PLUS JEUNE (`service.ts` → `youngest.rarity`). Mark Evans sort ainsi
				// en « Normal » (Frappe 133) alors qu'il a une variante BASARA à 207.
				// L'embed dit donc de quelle variante viennent ces chiffres au lieu de
				// les présenter comme LES statistiques du personnage.
				embed.addFields({
					name: `Statistiques niveau 99 — variante ${meilleure.rarity ?? "par défaut"}`,
					value: stats,
				});
			}

			const raretes = [...new Set(variantes.map((v) => v.rarity).filter(Boolean))];
			const equipe = await nomEquipe(perso);
			const contexte = joindre([
				equipe ? `Équipe **${equipe}**` : null,
				perso.series ? `Série **${perso.series}**` : null,
				variantes.length > 1
					? `${variantes.length} variantes${raretes.length > 1 ? ` (${raretes.join(", ")})` : ""}`
					: null,
				perso.internalCode ? `Code \`${perso.internalCode}\`` : null,
			]);
			if (contexte.length > 0) {
				embed.addFields({ name: "Contexte", value: contexte });
			}

			const illustration = illustrationAbsolue(perso.image) ?? iconeElementUrl(meilleure.element);
			if (illustration) {
				embed.setThumbnail(illustration);
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
							name: etiquette ? `${nomFr(technique.names)} — ${etiquette}` : nomFr(technique.names),
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
			const technique = (await ouvrirFiche<FicheTechnique>(
				async (cle) => (await azalee().skill(cle)) as unknown as FicheTechnique,
				async (texte) => {
					const liste = await azalee().skills({ q: texte, limit: 1 } as never);
					const trouve = (liste.data as unknown as FicheTechnique[])[0];
					return trouve ? String(trouve.skillId ?? trouve.internalCode ?? "") || null : null;
				},
				nom
			)) as FicheTechnique;
			const embed = rgEmbed()
				.setTitle(nomFr(technique.names, technique.displayName ?? "Technique"))
				.setURL(urlWiki(`/skill/${encodeURIComponent(String(technique.skillId ?? nom))}`));

			const resume = truncate(nomFr(technique.descriptions, "").replaceAll("\n", " "), 400);
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
			if (technique.videoUrl) {
				embed.addFields({ name: "Vidéo", value: technique.videoUrl });
			}

			const illustration = illustrationAbsolue(technique.image);
			if (illustration) {
				embed.setImage(illustration);
			}
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messageErreurAzalee(err)}` });
		}
	}

	@Slash({ name: "objet", description: "Fiche d'un objet (équipement, consommable, tactique…)" })
	async objet(
		@SlashOption({
			name: "nom",
			description: "Nom de l'objet",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: (interaction: AutocompleteInteraction) =>
				repondreSuggestions(interaction, async () => {
					const liste = await azalee().items({ q: saisie(interaction) || undefined, limit: 25 } as never);
					return (liste.data as unknown as FicheObjet[]).map((objet) => ({
						name: objet.category ? `${nomFr(objet.names)} — ${objet.category}` : nomFr(objet.names),
						value: String(objet.itemId ?? ""),
					}));
				}),
		})
		nom: string,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const objet = (await azalee().item(nom)) as unknown as FicheObjet;
			const embed = rgEmbed()
				.setTitle(nomFr(objet.names))
				.setURL(urlWiki(`/item/${encodeURIComponent(String(objet.itemId ?? nom))}`));

			const resume = truncate(nomFr(objet.descriptions, "").replaceAll("\n", " "), 400);
			if (resume.length > 0) {
				embed.setDescription(resume);
			}

			const fiche = joindre([
				objet.category ? `Catégorie \`${objet.category}\`` : null,
				typeof objet.price === "number" ? `Prix **${objet.price.toLocaleString("fr-FR")}**` : null,
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

			const illustration = illustrationAbsolue(objet.image);
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
					const equipes = (await azalee().teams()) as unknown as EntreeEquipe[];
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

			const resume = truncate(String(equipe.descriptionFr ?? equipe.descriptionEn ?? ""), 400);
			if (resume.length > 0) {
				embed.setDescription(resume);
			}
			const autresNoms = joindre([equipe.nameEn, equipe.nameJa]);
			if (autresNoms.length > 0) {
				embed.addFields({ name: "Autres noms", value: autresNoms });
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
			const embleme = illustrationAbsolue(equipe.emblemUrl);
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
			const resultat = (await azalee().search({ q: texte, limit: 8 })) as unknown as ResultatRecherche;
			const embed = rgEmbed()
				.setTitle(`Recherche « ${truncate(texte, 60)} »`)
				.setURL(urlWiki(`/search?q=${encodeURIComponent(texte)}`));

			const sections: Array<{ titre: string; lignes: string[] }> = [
				{
					titre: "Personnages",
					lignes: (resultat.characters ?? []).map(
						(perso) => `[${nomFr(perso.names)}](${urlWiki(`/chara/${perso.baseSlug ?? perso.slug}`)})`
					),
				},
				{
					titre: "Techniques",
					lignes: (resultat.skills ?? []).map(
						(technique) =>
							`[${nomFr(technique.names)}](${urlWiki(
								`/skill/${encodeURIComponent(String(technique.skillId))}`
							)})`
					),
				},
				{
					titre: "Objets",
					lignes: (resultat.items ?? []).map(
						(objet) =>
							`[${nomFr(objet.names)}](${urlWiki(`/item/${encodeURIComponent(String(objet.itemId))}`)})`
					),
				},
			];

			const remplies = sections.filter((section) => section.lignes.length > 0);
			if (remplies.length === 0) {
				await interaction.editReply({ content: `Aucun résultat pour « ${truncate(texte, 80)} ».` });
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
