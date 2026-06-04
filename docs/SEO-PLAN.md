# Plan SEO — Rose Griffon (website + azalee) & marque personnelle « yoyo »

Domaines : `rosegriffon.fr` (website), `azalee.rosegriffon.fr` (wiki IEVR).
Dev / marque personnelle : **Yohan Pierre (yoyo)** — https://x.com/yoyo__goat.

## État de départ (audit)

- **azalee** : déjà mûr (metadataBase, `generateMetadata` sur 41 routes, `sitemap.ts` 230 l, `robots.ts`, `manifest.ts`, `opengraph-image`, 58 fichiers JSON-LD).
- **website** : bonnes fondations (metadataBase, OG/Twitter, robots, speculation rules) MAIS :
  - sitemap **périmé** (pointait `/association`, `/apropos`, `/contact` — 404).
  - **aucun JSON-LD** Organization/WebSite/Person sur la home.
  - **aucun lien vers le wiki azalee** (ni home, ni footer) — pas de cross-linking.
- Concurrents (recherche bxc) : ils gagnent sur les **outils** — tier list, team builder, listes « passifs/esprits par saison ». C'est le gap à combler côté azalee.

## Fait (appliqué — commit en cours)

P0 — website & azalee :
- `AzaleeBanner` : CTA principal **« Explorer le wiki Azalée » → azalee.rosegriffon.fr** (ancre descriptive).
- `footer` : lien **« Wiki Azalée — Inazuma Eleven: Victory Road »** (cross-domain, présent sur toutes les pages).
- `app/layout.tsx` : JSON-LD `@graph` **Person (yoyo) + Organization + WebSite** (sameAs réseaux + azalee ; `founder`/`creator` = yoyo).
- `app/sitemap.ts` : réécrit avec les **22 routes publiques réelles** (fin des 404).
- `public/humans.txt` + `<link rel="author">` : crédit dev.
- **Réplication Person & rel="author"** : Crédit auteur et données structurées `Person` (yoyo) intégrés dans le layout d'**azalee**.
- **Correction des H1 manquants** : Balises `<h1>` visibles et descriptions stylisées ajoutées sur la home (`/`) du site web principal, et sur les pages d'index `/chara`, `/skill` et `/passive` du wiki.

## Marque personnelle « yoyo » — être en haut de Google (white-hat)

Levier principal : **consolidation d'entité Person** (Knowledge Graph). Fait sur rosegriffon.fr (Person sameAs x.com/yoyo__goat, founder de l'asso, crédit footer `rel="author me"`). À répliquer :

- P1 — Répliquer le crédit Person + lien `rel="author"` vers x.com/yoyo__goat sur **azalee** et **achillea** (même entité `@id`, même `sameAs`) → renforce le signal multi-domaines.
- P1 — Étoffer le `sameAs` de yoyo dès que d'autres profils publics existent (GitHub public, LinkedIn, site perso) — un `sameAs` riche = entité plus forte.
- P2 — Exposer un **site/landing perso** (le hub yoyo:8790 derrière un domaine, ou page `/yoyo`) avec ProfilePage schema → page canonique pour la requête « yoyo ».
- P2 — Bios des **bots Discord** (rpbey/achillea) et profils réseaux : même handle, même lien — cohérence NAP.

Honnêteté : le code pose tous les signaux corrects, mais le rang #1 dépend de Google (autorité, backlinks, temps, unicité du nom). Pas de black-hat (cloaking, keyword stuffing, faux liens) — risque de pénalité.

## Suite (P1/P2 — non encore appliqué)

- **azalee** : ajouter les schémas tools demandés par le marché (tier list, team builder) = pages à fort potentiel de mots-clés ; JSON-LD `Article`/`VideoObject` (RGTV) ; BreadcrumbList.
- **website** : Person/author sur azalee+achillea ; `Article` JSON-LD sur `/chroniques/[slug]` ; sitemap dynamique des chroniques ; corriger les 9 erreurs TS préexistantes (stripe apiVersion, googlemaps `importLibrary` v2.1, next.config typing).
- **Mesure** : Search Console (rosegriffon.fr + azalee), Core Web Vitals, suivi requêtes marque + « yoyo ».

## Best practices 2026 — écarts identifiés (recherche web)

Sources : DebugBear / Search Engine Land / Google AI-optimization-guide / Next.js learn (juin 2026).

- **GEO (Generative Engine Optimization)** : l'objectif bascule de « ranker » à « être CITÉ » par les IA. Les **données structurées sont le langage des LLM** → ajouter `Article`, `FAQPage`, `HowTo`, `BreadcrumbList` (en plus de Organization/WebSite/Person déjà posés). Contenu en **HTML serveur** (les crawlers IA ne lisent que le HTML rendu côté serveur, pas le client-side). Fraîcheur : maj contenu ≤ 3 mois (biais de récence des IA).
- **robots.txt IA** : autoriser explicitement GPTBot, ClaudeBot, anthropic-ai, Google-Extended, PerplexityBot, CCBot, Bytespider (en cours via l'agent cron).
- **Core Web Vitals 2026** : **INP < 200 ms** (a remplacé FID), LCP < 2,5 s, CLS < 0,1. Leviers : `next/image` + `priority` au-dessus de la ligne de flottaison, Server Components + streaming, défer JS non critique, débounce. Mesurer en **field data (CrUX)**, pas seulement lab.

## Librairies — état

Déjà présent : `@vercel/speed-insights`, `@vercel/analytics`, `@vercel/og`, `schema-dts` (typage JSON-LD). Stack bien équipé.
Manquant / optionnel : `web-vitals` (RUM custom — optionnel, Speed Insights couvre le field data). Le reste des écarts est du **contenu** (schémas Breadcrumb/FAQ/Article, h1) et non des libs.

## Audit bxc « en masse » — `scripts/seo-bxc-audit.ts` (exécuté)

Outil : drive `bxc recon` (rendu réel) + parse meta HTML (title/description/canonical/OG/JSON-LD/h1) sur un set curé d'URLs clés, en pool concurrent. À câbler en tâche cron `seo-site-audit`. Findings du 1er run (17 URLs, tout en 200) :

- **website `/` (home) : aucun `<h1>`** — à corriger (P0, signal SEO majeur).
- **website `/notre-equipe*`** : h1 absent + aucun JSON-LD → traité par l'agent /notre-equipe (ProfilePage/Person).
- **website `/chroniques`** : `og:image` absent ; `/a-propos`, `/nous-soutenir` : aucun JSON-LD.
- **azalee `/` : 4 h1** (cible 1) ; **`/chara`, `/skill`, `/passive` : aucun h1** (P0 — pages d'index à fort trafic) ; `/item`, `/aura`, `/news` : 2 h1 + JSON-LD manquant ; `/news` : description 57 car (cible 70-165).
