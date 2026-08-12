# Stockage secondaire — le second VPS comme archive froide

Le VPS principal (`51.77.147.152`) porte toute la production : les deux applications
Next, la base PostgreSQL, la pile qui remplace Supabase, le CDN — et le dump du jeu,
qui pèse à lui seul près de 70 Go. Son disque de 193 Go était plein à 91 %.

Le second VPS (`51.255.162.6`) n'héberge qu'achillea et shenron et laisse
plusieurs dizaines de gigaoctets inutilisés. Il sert désormais de **stockage
secondaire** : tout ce qu'aucun service ne lit y est déporté, avec un chemin de
retour en une commande.

## L'outil

```
bun scripts/ops/archive-froid.ts pousser <chemin...>   # déporte et libère la place
bun scripts/ops/archive-froid.ts recuperer <nom>       # rapatrie à l'emplacement d'origine
bun scripts/ops/archive-froid.ts lister                # inventaire
bun scripts/ops/archive-froid.ts espace                # place des deux côtés
```

Le transfert passe par `rsync` sur SSH : c'est l'outil de référence pour déplacer
une arborescence (reprise, attributs, delta), et réécrire un protocole de copie
n'apporterait rien. Bun orchestre, vérifie et tient l'index.

**Garde-fou** : rien n'est supprimé localement avant que la copie distante ait été
vérifiée — nombre de fichiers **et** total d'octets doivent concorder. En cas
d'écart le transfert échoue et la source reste intacte. Un simple `du` ne
suffirait pas : un fichier manquant peut être compensé par la taille d'un autre.

Chaque déport laisse à la place un témoin `<chemin>.archive-froid.json` qui dit où
retrouver le contenu, et une entrée dans `/srv/rg-archive/index.ndjson` sur l'hôte
de stockage — l'index vit là où sont les données.

Variables : `RG_ARCHIVE_HOTE`, `RG_ARCHIVE_RACINE`, `RG_ARCHIVE_MOTIF`.

## Ce qui a été déporté le 12 août 2026

| Contenu | Volume | Pourquoi c'est froid |
| --- | --- | --- |
| `data/dx11/menu` (69 624 PNG) | 12 Go | Cache pur — voir ci-dessous |
| `niers/var/niers.sqlite` | 6,8 Go | Base de reverse-engineering, lue seulement par `nie-cli` et `nie-explorer` en développement ; aucune unité systemd ne la référence |
| `niers/data/cross-apk/{tools,work,download}` | 3,3 Go | Outils et intermédiaires d'extraction de l'APK Cross ; l'extraction est terminée (`EXTRACTED.done`) et `extract/` reste en local pour la phase Il2CppDumper |
| `niers/var/ghidra-proj` | 450 Mo | Projet Ghidra, outillage hors ligne |
| `niers/data/backups` | 105 Mo | Sauvegardes de données inagle |

Purges locales complémentaires : `~/.cache/puppeteer` (641 Mo — un Chromium
orphelin, aucune référence dans le dépôt ; seul `bxc` est utilisé pour les tests et
le scraping), `node-gyp`, `pip`, les miroirs SQLite azalée au-delà des deux plus
récents, et les journaux systemd ramenés à 100 Mo.

## Le cas `data/dx11/menu` — pourquoi 12 Go étaient redondants

Ce dossier contenait 69 624 PNG **pré-décodés** par `niers menu-predecode`. Ce
n'est pas une source : c'est un cache du décodage G4TX→PNG que
`nie-model-serve` (:8790) sait faire à la volée depuis les CPK, qui eux restent en
local.

Trois vérifications, parce que `cdn.rosegriffon.fr` en dépend :

1. **Image identique.** Le PNG rendu par le décodeur et celui du dump : mêmes
   dimensions (3924 × 2932), même sRGB 8 bits, et `compare -metric RMSE` **nul** —
   pixel pour pixel identiques. Les octets, eux, diffèrent : le décodeur compresse
   mieux (2,36 Mio contre 2,94 Mio), ce qui allège aussi le transfert.
2. **Latence égale.** 30–40 ms par le décodeur contre 27–157 ms par le dump —
   `nie-model-serve` est en Rust avec un cache CPK de 8 Gio en mémoire.
3. **Chemin réel de la galerie.** La variante `?w=400&format=webp` (celle que sert
   `/gallery`) répond 200 avec la source absente.

Et surtout, le trafic : sur les sept jours de journaux nginx conservés,
`/dx11/menu/` a reçu **397 requêtes, dont 394 en 404**. Un seul PNG de ce dump de
69 624 fichiers avait été servi avec succès. Il occupait 12 Go pour rien.

> **Piège de méthode.** Une première vérification avait conclu « octet pour octet
> identique » : le fichier avait été renommé, mais nginx le servait encore depuis
> son cache de descripteurs. La comparaison n'était valable qu'une fois le fichier
> réellement absent. De même, échantillonner les chemins des journaux sans filtrer
> sur le code de retour donne surtout des chemins qui échouaient déjà.

### Trou préexistant à corriger

Ces 394 requêtes en échec ne sont pas causées par le déport : elles échouaient
déjà. Ce sont des **sous-textures** d'atlas G4TX (`whs00810_whs00810.png`,
`u11727100_l_u11727100_1.png`, `icon_item07_uni_u031801.png`) que demandent la
galerie et le navigateur CPK d'azalée, et que ni le dump ni le décodeur ne
produisent — `nie-model-serve` décode un G4TX entier, pas une sous-texture nommée.
C'est le seul manque réel sur cette surface.

nginx était déjà prêt pour ça : `location ^~ /dx11/` fait
`try_files $uri @cpk_live`, et `@cpk_live` proxifie vers le décodeur. Le dump
absent, tout passe par le décodeur sans changement de configuration.

`data/dx11/model` (227 Mo) reste en local : l'unité `nie-model-serve` le référence
explicitement (`--glb-dir`).

### Effet de bord corrigé dans `cdn-variants`

`apps/cdn-variants/server.ts` tentait d'abord l'ancien décodeur `iecode-cdn`
(:8788), retiré du dépôt le 11 août 2026 et dont le port ne répond plus, puis
seulement niers. Tant que le dump couvrait presque tout, cet aller-retour perdu
restait rare ; le dump parti, il serait devenu le cas courant. `nie-model-serve`
est donc passé en primaire, `LIVE_ORIGIN` en simple repli.

## Ce qui ne doit pas être déporté

- **`data/packs` (57 Go)** — les archives CPK. C'est la source de tout le contenu
  décodé en direct par le CDN. Les déporter couperait `cdn.rosegriffon.fr`.
- **`data/dx11/model`** — référencé par l'unité `nie-model-serve`.
- **`/opt/google/chrome`** — le navigateur que pilote `bxc`.
- **`niers/target`** — contient le binaire `nie-model-serve` en service.
