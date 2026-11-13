# 2026-11-05 — Hygiène, vague 3 (OG, titres, doublons, U+FFFD, security.txt, stockage)

Sources : `C:\src\yolo-web\docs\audit\rosegriffon-before.{md,json}` (constats 4, 9, 10 et
sonde `/.well-known/security.txt`) et `docs/audits/2026-11-05-crawl.md`.
Preuve : tests unitaires (aucun `next dev` lancé, un autre agent construit dans ce dossier)
et `curl` sur la production pour l'état « avant ». La production n'était pas encore
redéployée au moment de la rédaction : l'état « après » en production reste à relever.

## Commits

| SHA        | Objet                                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e3dc4dd6` | `og:image` sur toutes les pages (`withDefaultOgImage`), titres de sondage bornés (test), U+FFFD : initiales en graphèmes, coupes sans paire de substitution cassée, nettoyage du texte X |
| `71d80873` | Doublons « Instagram Instagram » / « X X » (puces de filtre `/feed`), note Patreon de `/nous-soutenir`                                                                                   |
| `fe4ef170` | `/.well-known/security.txt` (RFC 9116)                                                                                                                                                   |
| `95d7d265` | Objets de stockage absents : 404 au lieu de 400 (route Next + `infra/nginx/rg-core.conf`)                                                                                                |

## 1. og:title / og:image (16 pages)

Cause : Next fusionne `openGraph` superficiellement (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`, « Merging »).
L'image de `app/opengraph-image.png` est attachée au segment racine. `mergeStaticMetadata`
(`next/dist/lib/metadata/metadata-resolution-primitives.js`) ne l'applique qu'au segment qui
porte le fichier. Tout segment plus profond qui déclare `openGraph` sans `images` l'efface.
Les 16 URL n'avaient pas de problème d'`og:title` : il leur manquait toutes `og:image`.

Avant (production) :

```
$ curl -s https://rosegriffon.fr/evenements | grep -o '<meta property="og:[a-z:]*"'
og:title og:description og:url og:type              (pas d'og:image)
$ curl -s https://rosegriffon.fr/a-propos | grep -o '<meta property="og:image"'
og:image                                            (pose `images` à la main)
```

Correction : `withDefaultOgImage()` dans `src/lib/seo.ts` exige un `title` et pose
`DEFAULT_OG_IMAGE` (`/opengraph-image.png`, 1200×630) quand `images` est absent, vide ou
`undefined`. Elle est appliquée aux 16 URL du rapport (`/charte-engagements`, `/evenements`,
`/sondages` et ses variantes `?statut=` / `?page=`, `/wiki`, `/projets/nostalgie`,
`/projets/emotes`, `/contact` → `/a-propos/contact`, `/sondages/<id>` sans visuel) et à toutes
les autres pages qui avaient la même forme : 26 fichiers enveloppés, dont les fiches wiki
`aura`, `boutique`, `capsule`, `chara` (liste), `entraineur`, `item`, `passive`, `quete`,
`stade`, `succes`, `tactic`, ainsi que `sons`, `tools/stats`, `videos` et `news/tweet/<id>`.
`news/[slug]` et `wiki/skill/[id]` déclaraient `images: []` (ou `undefined`) sans visuel, ce
qui masquait aussi l'`opengraph-image.tsx` de leur propre segment (`hasOwnProperty('images')`).
La clé est maintenant omise.

Garde-fou : `src/lib/seo.test.ts` parcourt `src/app/**/{page,layout}.tsx` et échoue si un bloc
`openGraph: {` n'a pas d'`images` hors `withDefaultOgImage(...)`. Il a trouvé
`wiki/videos/page.tsx` au premier passage.

## 2. Titres `/sondages/<id>` (jusqu'à 106 caractères)

La production sert encore l'ancien titre : 105 caractères sur `/sondages/3e501896`
(`… Vous avez… · Sondages · Rose Griffon`). `4212ffdd` est sur `main` mais n'est pas déployé.
Le code actuel (`titleWithSuffix(resumeQuestion(q, 500), " · Sondages · Rose Griffon")`)
retire d'abord la marque, puis coupe sur un mot. Le test `poll titles` le vérifie sur les
questions du rapport : toutes tiennent en 65 caractères ou moins, et « Vice-Versa · Sondages ·
Rose Griffon » garde son suffixe. Aucun autre changement n'était nécessaire.

## 3. Mots doublés restants

| Constat                                                                                    | Cause                                                                                                                | Suite                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Instagram Instagram », « X X », « TikTok TikTok », « YouTube YouTube » (`/feed`, 22 URL) | `BadgeReseau` rendait le nom du réseau en `sr-only` juste à côté du nom visible dans les puces de filtre             | Nouveau prop `decoratif` (`aria-hidden`, sans `sr-only` ni `title`), utilisé dans `filtres.tsx`. Les autres usages, où aucun nom n'est écrit à côté, gardent leur nom accessible |
| « Patreon Patreon » (`/nous-soutenir`)                                                     | Le bouton « Voir tous les paliers sur Patreon » était suivi d'une note qui commençait par « Patreon prélève… »       | Note reformulée : « Sur chaque contribution, Patreon prélève 8 à 12 % de commission… »                                                                                           |
| « Président Président » (`/achillea/guide`)                                                | Faux positif : badges « Vice-Président » puis « Président », que l'heuristique coupe sur le trait d'union            | Rien à corriger                                                                                                                                                                  |
| « Hyroto Hyroto » (`/community`)                                                           | Donnée : le rôle Discord de ce membre s'appelle « Hyroto », comme son pseudo (2e ligne de `membre-carte.tsx` = rôle) | Non modifié (pas de dédoublonnage de chaînes)                                                                                                                                    |
| Bureau, Critique, Chroniques, Staff, Tournoi                                               | Déjà traités (`2026-11-05-textes-fixes.md`)                                                                          | —                                                                                                                                                                                |

## 4. U+FFFD (« � »)

Avant (production, HTML brut) :

```
/feed/status/2117892101677469750   2 × U+FFFD, tous deux dans <span … style="width:44px;height:44px">�</span>
/feed/status/2117890903591494027   1 × idem
/feed/status/2117889864750534761   1 × idem
/feed?groupe=Inazuma+Eleven        2 × U+FFFD dans le texte d'un post @InazumaCrossFR :
                                   "#イナイレクロス\uFFFD\u202F #InazumaEleven" (octets ef bf bd e2 80 af)
```

Deux causes :

1. **Initiale de l'avatar de repli** (`feed/carte-post.tsx`, `feed/fil-feed.tsx`,
   `components/achillea/UserAvatar.tsx`) : `nom.charAt(0)` sur un nom qui commence par un émoji
   (« シベリアチャンネル », « 沙々希Ω », relevés en base) rend la moitié haute d'une paire
   de substitution. Elle n'est pas encodable en UTF-8 et sort en U+FFFD. Correction :
   `initiale()` (`src/lib/unicode.ts`) prend le premier graphème avec `Intl.Segmenter`.
   Dans le même esprit, `clampText` (`seo.ts`) et `resumeQuestion` (`polls-types.ts`)
   coupaient avec `slice` et pouvaient casser une paire à la limite. Ils passent maintenant par
   `tronquerUnicode()`.
2. **Texte X déjà invalide à la source** : le fil lit X en direct par la CLI `aphrody x`
   (`lib/feed/live.ts`, `Response.text()`, donc décodage UTF-8 correct côté site). Le U+FFFD
   est déjà dans la sortie de la CLI. La même CLI alimente le cron, et la table `tweets` en
   contient un (`2091312708205564070`, `#イナイレ\uFFFD`). Le binaire est hors de ce dépôt et
   absent de cette machine, et l'octet d'origine est perdu, donc la source n'est pas réparable
   d'ici. Le texte est nettoyé au rendu, dans `postDepuisTweet()`
   (`sansCaracteresIllisibles()` retire U+FFFD et les moitiés de paire isolées).

Tests : `src/lib/unicode.test.ts` couvre les noms réels, les drapeaux et séquences ZWJ, le fait
que `clampText` ne produit jamais de moitié isolée (n = 1 à 39 sur un texte à émojis), et le
post @InazumaCrossFR passé dans `postDepuisTweet`.

## 5. security.txt

Avant : `curl -s -o /dev/null -w "%{http_code}" https://rosegriffon.fr/.well-known/security.txt` → `404`.

Après : route `src/app/.well-known/security.txt/route.ts`, régénérée chaque jour
(`revalidate = 86400`), contenu construit par `src/lib/security-txt.ts` :

```
Contact: mailto:contact@rosegriffon.fr
Contact: https://rosegriffon.fr/a-propos/contact
Expires: <maintenant + 1 an, RFC 3339>
Preferred-Languages: fr, en
Canonical: https://rosegriffon.fr/.well-known/security.txt
```

`contact@rosegriffon.fr` est l'adresse publique de l'association (cellule de médiation,
`/api/rg/info`). Les mentions légales renvoient au formulaire, qui figure en second `Contact`.
Test : `src/lib/security-txt.test.ts` vérifie les champs requis, l'unicité d'`Expires` et de
`Canonical`, le format, le `text/plain; charset=utf-8` et un `Expires` dans le futur.

## 6. Stockage : 400 « NoSuchKey » → 404

Avant (production) :

```
$ curl -s -w " %{http_code}" https://rosegriffon.fr/storage/v1/object/public/assets/campagnes/iergday/affiche-v2.webp
{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"} 400
$ curl -s -w " %{http_code}" https://cdn.rosegriffon.fr/storage/v1/object/public/assets/campagnes/iergday/affiche-v2.webp
{"statusCode":"404","error":"not_found","message":"Object not found","code":"NoSuchKey"} 400
```

Chaîne : site → réécriture `next.config.ts` → `cdn.rosegriffon.fr` (nginx `rg-core.conf`,
`try_files` disque puis `@storage`) → Supabase, qui renvoie 400 pour un objet absent. Chaque
relais recopiait ce statut.

Correction :

- Route `src/app/storage/v1/object/public/[bucket]/[...chemin]/route.ts` (GET/HEAD) qui
  remplace la réécriture des médias. `relayerObjet()` (`src/lib/storage-proxy.ts`) envoie
  `tweets`/`assets` vers rg-core et les autres buckets vers Supabase. Un 400 `NoSuchKey`
  ou `statusCode: "404"` devient un **404** avec cache court (300 s). Sinon, le corps, le
  statut (200/206/304), le type, le cache et les validateurs passent tels quels, sans
  `set-cookie` ni `content-length`.
- La réécriture générique `/storage/v1/:path*` vers Supabase passe en `fallback`. En
  `afterFiles`, elle serait passée avant les routes dynamiques (`rewrites.md`, ordre 6 puis 7).
- `infra/nginx/rg-core.conf` : `proxy_intercept_errors on; error_page 400 = @storage_absent;`
  dans `@storage`, qui renvoie 404. Ce changement n'est pas encore installé (voir Restes).

Test : `src/lib/storage-proxy.test.ts` rejoue la réponse réelle ci-dessus (→ 404), vérifie
qu'un 400 qui n'est pas un `NoSuchKey` reste 400, ainsi que le relais 200 (en-têtes filtrés),
le 304 et HEAD sans corps.

## Portes (à chaque commit)

`apps/rg-website` : `bun run typecheck` 0 erreur sur mes fichiers. Une erreur TS2769 est
apparue un temps dans `src/lib/feed/memo.test.ts`, un fichier non suivi d'un autre agent ; elle
avait disparu au dernier passage (« No type errors in 1,645 files »). `bun run lint` sort en 0.
`bun run test` : 523, puis 534 pass, 0 fail. `packages/rg-ui` : `bun run test` 153 pass,
0 fail (ratchet : aucune nouvelle chaîne JSX, une seule chaîne existante reformulée).

## Restes

- **Déploiement** : aucun des quatre commits n'est encore en production. À relever après
  déploiement : `og:image` sur `/evenements`, `/wiki`, `/sondages` ; titre de
  `/sondages/3e501896` ≤ 65 ; `/.well-known/security.txt` en 200 ; l'URL iergday en 404 ;
  plus de U+FFFD sur les quatre URL.
- **nginx rg-core** : `sudo install -m 644 infra/nginx/rg-core.conf /etc/nginx/conf.d/rg-core.conf && sudo nginx -t && sudo systemctl reload nginx`
  sur le VPS, sinon `cdn.rosegriffon.fr` répond toujours 400 en direct.
- **CLI `aphrody x`** : elle émet du U+FFFD dans certains textes, toujours juste après un hashtag
  japonais. Probablement une coupe d'octets UTF-8 au milieu d'un caractère, côté CLI. À corriger
  dans le dépôt de la CLI. La ligne `tweets` `2091312708205564070` garde son U+FFFD en base.
- **Affiches iergday** : les objets `affiche-v2.webp` / `reglement-v2.webp` manquent toujours.
  Il faut les téléverser ou retirer les références dans `src/app/iergday/page.tsx`. Ils
  répondront maintenant 404.
- « Hyroto Hyroto » : donnée Discord (rôle = pseudo), non modifiée.
