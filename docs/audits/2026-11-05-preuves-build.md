# Preuves du build de prod rg-website (2026-11-05)

## Build

Commande, depuis `apps/rg-website`, avec les URL de prod passées à cette seule commande :

```sh
BETTER_AUTH_URL=https://rosegriffon.fr NEXT_PUBLIC_SITE_URL=https://rosegriffon.fr NODE_ENV=production bun run build
```

Résultat : code de sortie 0. Log complet dans `var/build-rg-website.log` (353 lignes, non versionné). Avertissements : en-têtes Cache-Control personnalisés et alias de `sslmode` Postgres, aucune erreur.

## Serveur local de prod

```sh
NODE_ENV=production BETTER_AUTH_URL=https://rosegriffon.fr NEXT_PUBLIC_SITE_URL=https://rosegriffon.fr bun run start -- -p 3320
```

| Route         | HTTP | Temps  | Erreur SSR (`Children.only`, « Switched to client rendering ») |
| ------------- | ---- | ------ | -------------------------------------------------------------- |
| `/`           | 200  | 0,13 s | 0                                                              |
| `/legal/cgu`  | 200  | 0,18 s | 0                                                              |
| `/achillea`   | 200  | 0,02 s | 0                                                              |
| `/wiki`       | 200  | 0,03 s | 0                                                              |
| `/news`       | 200  | 2,36 s | 0                                                              |
| `/wiki/chara` | 200  | 1,99 s | 0                                                              |

## Navigateur (Chromium yolo-web, après chargement complet + 6 s)

Accueil (`accueil-roy.png`) :

- `<html class="roy">`, `--theme-wallpaper: url("/roy_bg.webp")` ;
- `main[data-slot=sidebar-inset]` : `linear-gradient(oklch(0.98 … / 0.93) …), url("/roy_bg.webp")`, fond d'écran sous un voile à 93 % ;
- logo `RG_Logo_V2.5.webp`, compagnon `RG_Roy_salut.webp`, `--primary #3f5b9a`.

Section esport `/achillea` (`achillea.png`) :

- `--theme-wallpaper: url("/fond_achilea.webp")`, logo `/achillea/logo1.svg` ;
- `#main-content.theme-achillea` : `--background #131313`, `--foreground #e8e8e8`, `--primary #cebaff` (violet), `--secondary #553e07` (or) ;
- la barre latérale garde le thème choisi par l'utilisateur (Roy), comme prévu.

Points ouverts transmis à l'agent de parité web Achilléa :

- les chiffres des stats et le lien du calendrier sont en citron vert, à confronter au legacy Angular ;
- une bande claire d'environ 64 px apparaît au-dessus du bloc sombre.

## Pas encore prouvé

- Réglage du thème par l'utilisateur (ThemeTuner) dans le navigateur.
- Lighthouse « après » (passe yolo-web-e4 en cours sur `TFu-T1mdhusiRm6TvkhaB`).
- Le déploiement en prod : prouvé, voir plus bas.

## Déploiements en prod (VPS RG, via `prod` → `vps`)

|                     | Déploiement 1                                                                                                     | Déploiement 2                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Commit              | `972fc663`                                                                                                        | `a03fbe7a`                                                         |
| rg-core             | redémarré 09:50:53 UTC, `cmp` binaire = build, NRestarts 0                                                        | redémarré 10:59:23 UTC, `cmp` binaire = build, NRestarts 0         |
| rg-website BUILD_ID | `ekHHwPMKZgZb-p8jStMCl` (10:03:40 UTC)                                                                            | `TFu-T1mdhusiRm6TvkhaB` (11:10:20 UTC)                             |
| Pages               | `/`, `/wiki`, `/feed`, `/achillea`, `/wiki/chara`, `/legal/cgu`, sitemap, robots : 200, bons titres, 0 erreur SSR | idem + `/community` 211 837 o (3,84 Mo avant), `/settings` noindex |
| Bots                | rg prêt, bot-azalee et bot-achillea 0 redémarrage                                                                 | idem                                                               |
| Cron                | 13 tâches réussies, 0 échec                                                                                       | 16 tâches réussies, 0 échec                                        |
| Rollback            | `/usr/local/bin/rg-core.63f281a4`, `apps/rg/old-cur`                                                              | `/usr/local/bin/rg-core.972fc663`, `apps/rg/old-cur`               |

## Données du wiki corrigées en prod (`rg-inagle-pg`)

- Noms : snapshot `inagle_characters-avant-noms-20261105T100617Z.dump`, puis `packages/azalee/scripts/plan-ievr-names-prod.ts`. Noms doublés : 4 098 lignes → 5 (doublons réels du jeu : Cao Cao, Pyon Pyon, Soyogi Soyogi). Public : `/wiki/chara` affiche « Jim Wraith » (18), plus aucun « Jim Jim ».
- Genres : snapshot `inagle_characters-avant-genre-20261105T103245Z.dump`, puis `plan-ievr-gender-prod.ts`. F/M 4 925/1 186 → M 4 925, F 1 089, null 97. Mark Evans, Axel Blaze, Jude Sharp : M ; Celia Hills, Nelly Raimon, Silvia Woods : F. Public : 740 « Masculin », 60 « Féminin » sur `/wiki/chara`.

## Consentement (prod, navigateur Chromium yolo-web, `https://rosegriffon.fr/`)

1. Sans choix : bandeau « Cookies et mesure d'audience » (Personnaliser, Tout refuser, Tout accepter) ; après 29 s et défilement, 0 requête Google, `dataLayer` vide.
2. Tout refuser : choix stocké `{mesure:false,pub:false}`, bandeau fermé, 0 requête Google.
3. « Gérer les cookies » du pied de page : bandeau rouvert en mode détaillé, cases décochées (choix précédent), labels associés.
4. Tout accepter puis un geste : `dataLayer` = `consent default` (tout `denied`) → `consent update` (tout `granted`) → `gtm.js` ; requêtes `googletagmanager.com/gtm.js` et `adsbygoogle.js` émises seulement à ce moment.

## Déploiements 3 et 4

|                        | Déploiement 3                                                                                                                                          | Déploiement 4                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Commit                 | `c46860ba`                                                                                                                                             | `a85cdedb`                                                     |
| rg-core                | redémarré 11:44:10 UTC, `cmp` = build                                                                                                                  | redémarré 20:09:37 UTC, `cmp` = build, NRestarts 0             |
| rg-website BUILD_ID    | `NBQTdKGMAmHmiobBBvJ_j` (11:53 UTC)                                                                                                                    | `4jmJfvtUOqqyh3TLvBCYl` (20:17:03 UTC)                         |
| Pages publiques        | 15 en 200, 0 erreur SSR, security.txt 200, plus de preconnect AdSense                                                                                  | 12 en 200 (dont `/design-system`), 0 erreur SSR                |
| Stockage, objet absent | CDN 404 (nginx `rg-core.conf` installé, `nginx -t` OK, sauvegarde `~/backups/rg-core.conf.avant-404`) ; via le site : **504 après 120 s** (régression) | via le site : **404 en 1,65 s** ; objet existant 200 en 0,50 s |
| Cron                   | n/a                                                                                                                                                    | 17 tâches réussies, 0 échec                                    |

Régression du déploiement 3 : la route de stockage attendait `body.cancel()` sur une branche du `tee()` que fait le `fetch` patché de Next ; cette promesse ne se résout qu'une fois l'autre branche annulée. Corrigé en `a72534b1` (test qui pend sans le correctif).

Build VPS du déploiement 4 : deux échecs de suite dans `next/font/google` (`null.exec(googleFontFileUrl)`). Les polices sont désormais auto-hébergées (`a85cdedb`, `src/fonts`, `next/font/local`) : le HTML de l'accueil ne référence plus `fonts.gstatic.com`/`fonts.googleapis.com`, les `@font-face` pointent vers `/_next/static/media/*.woff2` servis en 200 `font/woff2`. Le contrôle visuel des polices au navigateur n'a pas pu être fait (navigateur yolo-web fermé pendant une pénurie de mémoire locale).

Textures de jeu `cdn.rosegriffon.fr/dx11/…` : 502, car rg-core répond 404 (décodage des textures désactivé sur le VPS, pas de `NIE_GAME_DIR`). Non corrigé : décision de ne pas copier le jeu sur le VPS. `/news` remplace côté serveur les couvertures mortes.
