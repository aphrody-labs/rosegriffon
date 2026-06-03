/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tâche SEO : génération / rafraîchissement des fichiers `llms.txt`.
 *
 * Le standard llms.txt (https://llmstxt.org) est un index Markdown placé à la
 * racine d'un site, lu par les crawlers IA pour comprendre le contenu et les
 * pages clés. On génère :
 *   - `llms.txt`      : index concis (présentation + liens principaux)
 *   - `llms-full.txt` : version étendue (sections détaillées)
 *   - `llm.txt`       : alias de `llms.txt` (référencé par les métadonnées du
 *                       website, alternates.types["text/markdown"]).
 *
 * Les fichiers sont écrits dans apps/website/public et apps/azalee/public, donc
 * servis statiquement par Vercel à la racine de chaque domaine. La régénération
 * via cron garde la date `Généré le …` fraîche (signal de fraîcheur).
 *
 * Ce qui est garanti : des fichiers à jour et conformes au standard, lisibles
 * par tout crawler IA qui le souhaite. Ce qui ne l'est PAS : qu'un LLM précis
 * (Claude, Gemini, Grok, ChatGPT…) ingère ou cite réellement le contenu — cela
 * dépend entièrement de l'éditeur du modèle.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

// Racine du monorepo, déduite depuis l'emplacement de ce fichier
// (packages/cron/src/tasks/seo/llms-txt.ts → remonter de 5 niveaux).
const MONOREPO_ROOT = join(import.meta.dir, "..", "..", "..", "..", "..");
const WEBSITE_PUBLIC = join(MONOREPO_ROOT, "apps", "website", "public");
const AZALEE_PUBLIC = join(MONOREPO_ROOT, "apps", "azalee", "public");

const DEV_CREDIT = "yoyo — https://x.com/yoyo__goat";

function nowStamp(): string {
	return new Date().toISOString().slice(0, 10);
}

// ─── WEBSITE (rosegriffon.fr) ────────────────────────────────────────────────

function websiteLlms(): string {
	return `# Rose Griffon

> Association française dédiée à la communauté Inazuma Eleven. Rose Griffon rassemble les fans francophones autour d'événements, de projets créatifs et de contenus sur la licence Inazuma Eleven (LEVEL-5).

Site officiel : https://rosegriffon.fr
Wiki Azalée (Inazuma Eleven: Victory Road) : https://azalee.rosegriffon.fr
Développeur & fondateur : ${DEV_CREDIT}
Généré le : ${nowStamp()}

## Pages principales

- [Accueil](https://rosegriffon.fr/) : présentation de l'association Rose Griffon.
- [Notre équipe](https://rosegriffon.fr/notre-equipe) : association, staff, partenaires.
- [À propos](https://rosegriffon.fr/a-propos) : qui sommes-nous, comment rejoindre.
- [Projets](https://rosegriffon.fr/projets) : projets créatifs de la communauté (Nostalgie, émotes, muraux, outils).
- [Événements](https://rosegriffon.fr/evenements) : tournois, rencontres et événements communautaires.
- [Chroniques](https://rosegriffon.fr/chroniques) : articles et actualités de l'association.
- [Nous soutenir](https://rosegriffon.fr/nous-soutenir) : soutenir Rose Griffon.

## Réseaux & liens

- Wiki Azalée : https://azalee.rosegriffon.fr
- X / Twitter Azalée : https://x.com/Azalee_IE
- Développeur (yoyo) : https://x.com/yoyo__goat

## Ressources

- [Sitemap](https://rosegriffon.fr/sitemap.xml)
- [robots.txt](https://rosegriffon.fr/robots.txt)
`;
}

function websiteLlmsFull(): string {
	return `# Rose Griffon — Référence complète

> Rose Griffon est une association française dédiée à la communauté Inazuma Eleven (licence LEVEL-5). Elle fédère les fans francophones autour d'événements, de projets créatifs collaboratifs et de contenus d'information, et maintient le wiki Azalée consacré à Inazuma Eleven: Victory Road.

Site officiel : https://rosegriffon.fr
Wiki Azalée : https://azalee.rosegriffon.fr
Développeur & fondateur : ${DEV_CREDIT}
Langue : fr-FR
Généré le : ${nowStamp()}

## À propos de l'association

Rose Griffon rassemble la communauté Inazuma Eleven en France. L'association
organise des événements, anime des projets communautaires et produit des
contenus (articles, outils, ressources) autour de la licence Inazuma Eleven.

- [Accueil](https://rosegriffon.fr/)
- [À propos](https://rosegriffon.fr/a-propos)
- [Rejoindre Rose Griffon](https://rosegriffon.fr/a-propos/rejoindre-rg)
- [Contact](https://rosegriffon.fr/a-propos/contact)
- [Charte & engagements](https://rosegriffon.fr/charte-engagements)
- [Cellule de médiation](https://rosegriffon.fr/cellule-de-mediation)

## Équipe

- [Notre équipe](https://rosegriffon.fr/notre-equipe)
- [Association](https://rosegriffon.fr/notre-equipe/association)
- [Staff](https://rosegriffon.fr/notre-equipe/staff)
- [Partenaires](https://rosegriffon.fr/notre-equipe/partenaires)

## Projets

- [Projets](https://rosegriffon.fr/projets)
- [Nostalgie](https://rosegriffon.fr/projets/nostalgie)
- [Émotes](https://rosegriffon.fr/projets/emotes)
- [Muraux](https://rosegriffon.fr/projets/muraux)
- [Outil PFP](https://rosegriffon.fr/projets/outils/pfp)

## Contenus & communauté

- [Événements](https://rosegriffon.fr/evenements)
- [Chroniques](https://rosegriffon.fr/chroniques)
- [Communauté](https://rosegriffon.fr/community)
- [Nous soutenir](https://rosegriffon.fr/nous-soutenir)

## Wiki Azalée

Azalée est le wiki francophone d'Inazuma Eleven: Victory Road maintenu par Rose
Griffon : personnages, techniques, objets, auras (esprits guerriers, totems,
miximax…), tactiques et actualités.

- Wiki : https://azalee.rosegriffon.fr
- Personnages : https://azalee.rosegriffon.fr/chara
- Techniques : https://azalee.rosegriffon.fr/skill
- Objets : https://azalee.rosegriffon.fr/item
- Auras : https://azalee.rosegriffon.fr/aura
- Actualités : https://azalee.rosegriffon.fr/news

## Mentions légales

- [Mentions légales](https://rosegriffon.fr/mentions-legales)
- [CGU](https://rosegriffon.fr/legal/cgu)
- [Confidentialité](https://rosegriffon.fr/legal/confidentialite)

## Crédits

Conception, développement full-stack et architecture : ${DEV_CREDIT}.
Stack : Next.js, React, Bun, TypeScript, Supabase.
`;
}

// ─── AZALÉE (azalee.rosegriffon.fr) ──────────────────────────────────────────

function azaleeLlms(): string {
	return `# Azalée — Wiki Inazuma Eleven: Victory Road

> Wiki francophone consacré à Inazuma Eleven: Victory Road (IEVR), maintenu par l'association Rose Griffon. Base de données complète : personnages, techniques, objets, auras, tactiques et actualités.

Wiki : https://azalee.rosegriffon.fr
Association : Rose Griffon — https://rosegriffon.fr
Développeur & fondateur : ${DEV_CREDIT}
Généré le : ${nowStamp()}

## Sections principales

- [Personnages](https://azalee.rosegriffon.fr/chara) : fiches des joueurs et personnages.
- [Techniques](https://azalee.rosegriffon.fr/skill) : techniques spéciales (tirs, dribbles, blocs, gardiens).
- [Objets](https://azalee.rosegriffon.fr/item) : objets et équipements.
- [Auras](https://azalee.rosegriffon.fr/aura) : esprits guerriers, totems, miximax, éveils, changements de mode.
- [Passifs](https://azalee.rosegriffon.fr/passive) : compétences passives.
- [Tactiques](https://azalee.rosegriffon.fr/tactic) : tactiques d'équipe.
- [Actualités](https://azalee.rosegriffon.fr/news) : news et patch-notes du jeu.
- [Outils](https://azalee.rosegriffon.fr/tools) : comparateur, équipe aléatoire, traducteur.

## Réseaux & liens

- Site Rose Griffon : https://rosegriffon.fr
- X / Twitter Azalée : https://x.com/Azalee_IE
- Développeur (yoyo) : https://x.com/yoyo__goat

## Ressources

- [Sitemap](https://azalee.rosegriffon.fr/sitemap.xml)
- [robots.txt](https://azalee.rosegriffon.fr/robots.txt)
`;
}

function azaleeLlmsFull(): string {
	return `# Azalée — Wiki Inazuma Eleven: Victory Road — Référence complète

> Azalée est le wiki francophone de référence pour Inazuma Eleven: Victory Road (IEVR), le jeu de LEVEL-5. Maintenu par l'association Rose Griffon, il agrège personnages, techniques, objets, auras, tactiques, compétences passives et actualités du jeu, avec des outils communautaires.

Wiki : https://azalee.rosegriffon.fr
Association : Rose Griffon — https://rosegriffon.fr
Développeur & fondateur : ${DEV_CREDIT}
Langue : fr-FR
Généré le : ${nowStamp()}

## Présentation

Azalée recense les données de jeu d'Inazuma Eleven: Victory Road et propose des
fiches détaillées ainsi que des outils (comparaison, génération d'équipe,
traduction). Le wiki est produit et maintenu par Rose Griffon, association
française de la communauté Inazuma Eleven.

## Base de données

- [Personnages](https://azalee.rosegriffon.fr/chara) : fiches complètes des personnages jouables.
- [Techniques](https://azalee.rosegriffon.fr/skill) : tirs, dribbles, blocs et techniques de gardien.
- [Objets](https://azalee.rosegriffon.fr/item) : objets, équipements et consommables.
- [Auras](https://azalee.rosegriffon.fr/aura) : esprits guerriers, totems, miximax, éveils, changements de mode.
  - [Esprits guerriers](https://azalee.rosegriffon.fr/aura/esprits-guerriers)
  - [Totems](https://azalee.rosegriffon.fr/aura/totems)
  - [Miximax](https://azalee.rosegriffon.fr/aura/miximax)
  - [Éveil](https://azalee.rosegriffon.fr/aura/eveil)
  - [Changement de mode](https://azalee.rosegriffon.fr/aura/changement-mode)
- [Passifs](https://azalee.rosegriffon.fr/passive) : compétences passives.
- [Tactiques](https://azalee.rosegriffon.fr/tactic) : tactiques d'équipe.

## Actualités

- [News](https://azalee.rosegriffon.fr/news) : actualités du jeu et de la communauté.
- [Patch-notes](https://azalee.rosegriffon.fr/patch-notes) : notes de mise à jour.

## Outils

- [Outils](https://azalee.rosegriffon.fr/tools)
- [Comparateur](https://azalee.rosegriffon.fr/tools/compare)
- [Équipe aléatoire](https://azalee.rosegriffon.fr/tools/random-team)
- [Traducteur](https://azalee.rosegriffon.fr/tools/translator)
- [Recherche](https://azalee.rosegriffon.fr/search)

## Mentions légales

- [CGU](https://azalee.rosegriffon.fr/legal/cgu)
- [Confidentialité](https://azalee.rosegriffon.fr/legal/confidentialite)
- [Mentions légales](https://azalee.rosegriffon.fr/legal/mentions-legales)

## Crédits

Conception, développement et architecture : ${DEV_CREDIT}.
Stack : Next.js, React, Bun, TypeScript. Données : Inazuma Eleven: Victory Road (LEVEL-5).
`;
}

export async function runSeoLlmsTxt(): Promise<{ success: boolean; error?: string }> {
	console.log("[SEO llms.txt] Génération des fichiers llms.txt / llms-full.txt / llm.txt…");
	try {
		const websiteIndex = websiteLlms();
		const azaleeIndex = azaleeLlms();

		const targets: Array<{ path: string; content: string }> = [
			// Website : llm.txt est l'alias référencé par les métadonnées Next.
			{ path: join(WEBSITE_PUBLIC, "llms.txt"), content: websiteIndex },
			{ path: join(WEBSITE_PUBLIC, "llm.txt"), content: websiteIndex },
			{ path: join(WEBSITE_PUBLIC, "llms-full.txt"), content: websiteLlmsFull() },
			// Azalée.
			{ path: join(AZALEE_PUBLIC, "llms.txt"), content: azaleeIndex },
			{ path: join(AZALEE_PUBLIC, "llm.txt"), content: azaleeIndex },
			{ path: join(AZALEE_PUBLIC, "llms-full.txt"), content: azaleeLlmsFull() },
		];

		for (const { path, content } of targets) {
			await writeFile(path, content, "utf-8");
			console.log(`[SEO llms.txt] Écrit : ${path} (${content.length} octets)`);
		}

		console.log(`[SEO llms.txt] ${targets.length} fichiers générés avec succès.`);
		return { success: true };
	} catch (err: any) {
		console.error("[SEO llms.txt] Erreur lors de la génération :", err);
		return { success: false, error: err.message || String(err) };
	}
}
