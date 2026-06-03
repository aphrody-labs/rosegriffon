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

P0 — website :
- `AzaleeBanner` : CTA principal **« Explorer le wiki Azalée » → azalee.rosegriffon.fr** (ancre descriptive).
- `footer` : lien **« Wiki Azalée — Inazuma Eleven: Victory Road »** (cross-domain, présent sur toutes les pages).
- `app/layout.tsx` : JSON-LD `@graph` **Person (yoyo) + Organization + WebSite** (sameAs réseaux + azalee ; `founder`/`creator` = yoyo).
- `app/sitemap.ts` : réécrit avec les **22 routes publiques réelles** (fin des 404).
- `public/humans.txt` + `<link rel="author">` : crédit dev.

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
