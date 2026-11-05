# Poids de page : preuves avant / après (2026-11-05)

Suite de `2026-11-05-crawl.md`, points 3, 4, 5 et 10.

## Méthode

- Avant : serveur de dev partagé (port 3311, `next dev` d'un autre agent, même répertoire ; Next refuse un second `next dev`) et build de prod de 10:36 servi en local.
- Après : build de prod local (`BETTER_AUTH_URL=https://rosegriffon.fr bun run build`, sortie 0), servi par
  `NODE_ENV=production BETTER_AUTH_URL=https://rosegriffon.fr NEXT_PUBLIC_SITE_URL=https://rosegriffon.fr bun run start -- -p 3331`.
- Mesures : `curl` (octets HTML, nombre de `<img>`/`<video>`), puis Chromium (yolo-web) pour les requêtes médias et le CLS.

## 1. Vidéos `/iergday?campagne=inazuma-rg-2` (commit a25b4280)

| | Avant | Après |
|---|---|---|
| `<video>` dans le HTML SSR | 2 (`preload="metadata"`, 1 `.mp4` 28 Mo + 1 `.mov` 27 Mo) | 0 (2 aplats `lucide-play`) |
| Navigateur, page déroulée en bas | ~55 Mo de vidéo d'après le crawl | 1 `<video>` montée (`.mp4`, `preload="none"`, `readyState` 0), **0 requête `.mp4`/`.mov`** |
| `.mov` | embarqué | jamais monté ; visionneuse : « Média indisponible » + bouton Télécharger déjà présent |
| HTML | 233 496 o | 233 157 o |

`VignetteVideo` monte la balise seulement près du viewport (IntersectionObserver, 200 px), en `preload="none"` ; seul le survol lance `play()`. Discord ne fournit pas d'affiche : un aplat avec pictogramme reste peint sous la balise.

## 2. Visuels de campagne en 400 (commit 8e6dacb7)

Les URL sont bien construites : les mêmes chemins `campagnes/<slug>/discord/*` répondent 200. Les objets manquent dans le stockage, sur `rosegriffon.fr`, `cdn.rosegriffon.fr` **et** l'origine Supabase (`{"statusCode":"404","error":"not_found","code":"NoSuchKey"}`) :
`iergday/affiche-v2.webp`, `iergday/reglement-v2.webp`, `iergday/couverture.webp` (200 le 13/8 d'après la migration 20260813_01), `iergday/instagram/DcUEDDKoTgP.jpg`, `inazuma-rg-2/affiche.webp`.

Correctif côté code : `sonderImage()` (`lib/images/dimensions.ts`) note les 4xx au rendu (mémo 5 min) et la page n'émet pas le visuel ; un échec tardif côté client garde son cadre avec un pictogramme au lieu de retirer la carte (le retrait causait le saut).

| `/iergday` (prod locale) | Avant | Après |
|---|---|---|
| `<img>` affiche/règlement morts | 2 (+ `link rel=preload`) | 0 |
| Ressources en 4xx (navigateur) | affiche-v2, reglement-v2 | aucune |
| CLS (Chromium, chargement sans interaction) | 0,52 (Lighthouse de base) | 0,107, source unique `MAIN.bg-background` (coque, pas les visuels) |

**Pas fait** : ré-téléverser les fichiers manquants (données, hors code) ; le `og:image` de la campagne pointe toujours vers `couverture.webp` mort (métadonnées : autre agent).

## 3. `/community` paginée (commit 965716f8)

60 cartes par page (`?page=`), sections Discord conservées dans l'ordre, l'effectif du titre reste le total du rôle. Avatars `next/image` en `width`/`height` 40 explicites, `loading="lazy"`.

| URL | Avant (octets, `<img>`) | Après (octets, `<img>`) |
|---|---|---|
| `/community` | 3 840 732, 1 843 | 211 357, 65 |
| `/community?serveur=achillea` | 6 371 634, 3 144 | 205 282, 65 |
| `/community?serveur=achillea&page=53` (dernière) | - | 120 331, 24 |

Les 65 `<img>` sont toutes en `loading="lazy"`, dont 60 avatars en `width="40" height="40"`.

## 4. JS de `/legal/cgu`

La page est un Server Component sans îlot client : tout le JS vient de la coque (`client-layout.tsx` et ses providers). La coque n'a pas été modifiée. Correctif : `useProfileSync` (dans `ProfileProvider`, donc sur toutes les pages) importait `@/lib/realtime` en statique, donc supabase-js ; l'import est maintenant dynamique, lancé seulement pour un utilisateur connecté.

| `/legal/cgu`, scripts `<script src>` hors polyfills (`nomodule`) | Avant | Après |
|---|---|---|
| Nombre | 43 | 41 |
| Octets bruts | >= 1 796 303 (39 plus gros) | 1 533 921 |
| gzip | >= 567 014 | 499 223 |
| Chunk supabase-js (`85823-*`, 171 078 o / 47 266 o gz) | chargé | absent (aucun script ne contient `X-Client-Info`) |

Le build « avant » vient d'un autre état du dépôt (10:36), donc seule la disparition du chunk supabase-js est imputable avec certitude à ce changement.

Ce qui reste chargé et pourrait être coupé (pas fait, parce que ça touche la coque ou un autre périmètre) :
- `78177-*` (260 Ko, 92 Ko gz) : `public/locales/fr.json` importé en statique par `LanguageProvider`, envoyé en entier à chaque page (traductions : autre agent).
- `51685-*` (100 Ko, 28 Ko gz) : zod, tiré dans le même groupe que le baril `@rosegriffon/ui`.
- `515-*`, `98074-*` (~120 Ko) : client Achilléa (`AchilleaAuthProvider`, visibilité de la nav e-sport), monté partout.
- React DOM et le runtime Next (`87c73c54-*`, `7730-*`, ~450 Ko) : incompressibles.
