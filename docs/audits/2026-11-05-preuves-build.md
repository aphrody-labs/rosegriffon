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

| Route | HTTP | Temps | Erreur SSR (`Children.only`, « Switched to client rendering ») |
|---|---|---|---|
| `/` | 200 | 0,13 s | 0 |
| `/legal/cgu` | 200 | 0,18 s | 0 |
| `/achillea` | 200 | 0,02 s | 0 |
| `/wiki` | 200 | 0,03 s | 0 |
| `/news` | 200 | 2,36 s | 0 |
| `/wiki/chara` | 200 | 1,99 s | 0 |

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
- Lighthouse sur le build de prod.
- Le déploiement en prod.
