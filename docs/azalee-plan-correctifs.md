# Azalée — plan de correction (navigation, URLs, SEO, UI, données)

Audit du 14/8/2026 sur `apps/azalee` (88 pages, Next 16 App Router). Chaque constat
ci-dessous a été vérifié par lecture du fichier réel, requête HTTP sur la production,
ou mesure sur le miroir SQLite `apps/azalee/data/backups/mirror.sqlite`. Les chiffres
sont des chiffres mesurés, pas des estimations.

Statut : **FAIT** = livré et déployé · **À FAIRE** = reste à traiter · **SANS SUITE** =
vérifié comme non comblable, à ne pas tenter.

---

## 1. Navigation et barre latérale

| # | Constat | Statut |
|---|---|---|
| 1.1 | `/mode` existait, était déclarée 6ᵉ collection média par `MediaShell`, mais absente du menu, des `activePaths` mobiles et du plan de site | **FAIT** |
| 1.2 | L'état actif se calculait par égalité stricte : sur `/chara/<id>`, `/skill/<id>` et les 16 autres familles de fiches, **aucune entrée du menu n'était mise en avant** | **FAIT** (`estItemActif`) |
| 1.3 | `pathname.startsWith(path)` sans frontière de segment : `/modeles` allumait aussi l'entrée `/mode` | **FAIT** (`estRouteActive`) |
| 1.4 | Trois calculs d'état actif divergents (colonne, rail, barre du bas) | **FAIT** — une seule fonction dans `config/navigation.ts` |
| 1.5 | Tout le menu était rendu derrière un `mounted &&` : le HTML serveur ne contenait **aucun lien de navigation** | **FAIT** — seules les entrées d'administration attendent le montage |
| 1.6 | Le rail liait les entêtes de groupe vers des routes inexistantes (4 × 404 sur le tableau de bord) | **FAIT** |
| 1.7 | 10 clés i18n du tableau de bord absentes de `en.json` et `ja.json` → clé brute affichée | **FAIT** |
| 1.8 | `nav.wiki.models` = « Modèles 3D — Objets » alors que `/modeles` couvre les 6 236 modèles | **FAIT** |
| 1.9 | `dashboardItems` et `dashboardMobileItems` sont du **code mort** : `Shell.tsx` ne monte ces composants que si `!isDashboard`. La vraie navigation d'administration est `DashboardSidebar.tsx`, en français codé en dur, sans i18n | À FAIRE |
| 1.10 | Menu replié : les enfants deviennent inatteignables (`/passive`, `/tactic`, `/boutique`, `/capsule`, `/invocation`, `/drops`, `/entraineur`, `/stade`, `/textures`, `/sons`, `/videos`, `/modeles`, `/patch-notes` et les 5 catégories d'aura). Même trou sur le rail 600–839 px | À FAIRE |
| 1.11 | Menu replié : 15 entrées × 56 px dépassent la hauteur disponible et `SidebarContent` porte `overflow-hidden` en mode icône → les dernières entrées sont coupées | À FAIRE |
| 1.12 | Le tiroir mobile ne se referme pas après un clic sur un lien | À FAIRE |
| 1.13 | La barre latérale n'est pas un repère de navigation : ni `<nav>`, ni `aria-label` | À FAIRE |
| 1.14 | Les groupes ne se rouvrent pas seuls lors d'une navigation client (`useState` sans resynchronisation) | À FAIRE |
| 1.15 | `Shell.tsx` teste des routes inexistantes : `/team` (la vraie est `/equipe`) et `/wiki` | À FAIRE |
| 1.16 | `isEditorPage` teste `pathname.includes("/new")`, qui correspond aussi à `/news` | À FAIRE |
| 1.17 | Le rail ignore `commonSprite` : `/chara` a le sprite du jeu en colonne et une icône générique en rail | À FAIRE |
| 1.18 | Doublons parent/enfant (6 groupes dont le parent mène à la même route que le premier enfant) → deux lignes actives en même temps | À FAIRE |
| 1.19 | `/tools/niers` absent du menu ; le hub `/tools` omet `/tools/stats`, `/save` et `/demo` | À FAIRE |
| 1.20 | `activePaths` mobiles : deux valeurs mortes (`/keshin` redirige, `/wiki` n'existe pas), `/save` manquant | Partiellement FAIT (ajouts) — retraits À FAIRE |

## 2. Identifiants d'URL et routage

| # | Constat | Statut |
|---|---|---|
| 2.1 | **404 souple généralisé** : un `loading.tsx` en amont fait partir la coquille avant l'exécution de `notFound()`, donc toutes les fiches introuvables répondaient **200** avec un corps « 404 » | **FAIT** — squelettes de liste isolés dans des groupes `(liste)`, squelettes de fiche retirés ; vérifié en production (`/equipe/0xDEADBEEF` → 404) |
| 2.2 | `/boutique/1629770002abc` servait la vraie boutique (`parseInt` permissif) : espace d'URL infini, chaque variante auto-canonique | **FAIT** |
| 2.3 | Double `decodeURIComponent` sur `/cpk` et `/news/tag` (Next décode déjà) : `URIError` renvoyée en HTTP 200 sans titre, et `%252F` silencieusement transformé | **FAIT** |
| 2.4 | Un tag d'actualité inexistant répondait 200 avec « 0 article » et sans canonique | **FAIT** |
| 2.5 | La casse : `/item/0x5f0f1eac` est introuvable là où `/item/0x5F0F1EAC` existe. Seuls `/quete` et `/succes` normalisent | À FAIRE — normaliser à la lecture dans la bibliothèque, pas dans chaque page |
| 2.6 | **326 `base_slug` regroupent plusieurs personnages** ; `/chara/unknown` fusionne à lui seul 53 identifiants distincts, dont un seul est rendu | À FAIRE — dériver un slug distinct (nom + discriminant) plutôt que de laisser 52 fiches inatteignables |
| 2.7 | Un personnage a un slug commençant par un tiret (`-0x3855B5EA`) : son nom japonais se slugifie en chaîne vide | À FAIRE |
| 2.8 | Trois formes d'URL par personnage (`base_slug`, slug de variante, identifiant brut), **chacune auto-canonique** ; idem `/passive` (hex ou `ps…`), `/skill` (code ou hash), `/aura` (deux catégories pour la même aura) | À FAIRE — choisir la forme canonique et rediriger les autres en 308 |
| 2.9 | `/aura/autres` : la catégorie est produite par la recherche et les fiches de personnage, mais absente de la liste des catégories → page vide, et le fil d'Ariane de chaque fiche « autres » pointe dessus | À FAIRE |
| 2.10 | 8 lignes de boutique sans objet identifiable produisent des liens `/item/<shop>:<slot>` qui ne résoudront jamais | À FAIRE |
| 2.11 | Aucune liste blanche sur `/dashboard/database/[table]/[id]` (la table est passée telle quelle à `.from()`), alors que la page de liste en a une | À FAIRE |
| 2.12 | `getAllTeamIds()` a été écrit pour `generateStaticParams` et n'est appelé nulle part | Repris par le plan de site |

## 3. Référencement

| # | Constat | Statut |
|---|---|---|
| 3.1 | **Les 282 fiches d'aura n'étaient pas dans le plan de site** : la requête triait sur `created_at`, colonne inexistante sur `inagle_keshins` ; l'erreur était avalée par un `if (data)` | **FAIT** — passage par le service, les 5 familles couvertes |
| 3.2 | 70 URLs `/tactic/<hex>` du plan de site ne résolvaient rien (les tactiques se résolvent par `internal_code`) et doublonnaient `/item/<même hex>` | **FAIT** |
| 3.3 | Le plan de site publiait les 6 148 slugs de variante alors que le site lie les 5 204 `base_slug` : **aucune URL annoncée n'était celle du maillage** | **FAIT** |
| 3.4 | Aucune fiche annoncée pour équipes (208), boutiques, quêtes (182), stades (81), succès (228), capsules (740), entraîneurs (102), passifs | **FAIT** |
| 3.5 | 34 URLs `/skill/*_or` publiées alors que le service les exclut de la liste | **FAIT** |
| 3.6 | `/mode`, `/niveau`, `/demo`, `/modeles/animal` absents du plan de site | **FAIT** |
| 3.7 | `q`, `sort` et `perPage` entraient dans les URL canoniques : chaque tri et chaque recherche devenait une page canonique de plus | **FAIT** |
| 3.8 | `/search?q=…` s'auto-déclarait canonique et indexable : espace d'index non borné | **FAIT** — canonique fixe + `noindex, follow` |
| 3.9 | `robots.txt` interdisait `/api/`, donc l'image de partage des 5 204 fiches de personnage (`/api/og/character`) ; `/profil/` et `/maintenance` n'étaient pas exclus | **FAIT** |
| 3.10 | 12 pages ne livraient **aucune** `og:image` : déclarer `openGraph` sans `images` remplace l'image de convention (fusion superficielle) | Partiellement FAIT (`/niveau`) — 11 pages À FAIRE |
| 3.11 | Déclarer un bloc `twitter` sans `site`/`creator` efface `@Azalee_IE` (6 fiches) ; 8 autres fiches n'ont aucun bloc `twitter` | À FAIRE |
| 3.12 | `generateMetadata` émet canonique et `openGraph.url` **même quand l'entité est introuvable** : une URL qui répond 404 se déclare canonique | Partiellement FAIT (`/boutique`) — reste À FAIRE |
| 3.13 | `/item` se canonicalise vers `/item?category=shoes` (catégorie par défaut) alors qu'il est annoncé à priorité 0.8 | À FAIRE |
| 3.14 | `/demo` pointe une `og:image` en 404 (`/opengraph-image` sans extension) | À FAIRE |
| 3.15 | Les cartes de partage générées de `/skill/<id>` et `/item/<id>` sont écrasées par un visuel générique | À FAIRE |
| 3.16 | `og:site_name` a trois valeurs différentes selon la page | À FAIRE |
| 3.17 | 1 314 fiches de personnage portent un titre dupliqué (381 noms en double, dont 58 « Personnage ») ; 161 sur les techniques | À FAIRE — discriminer par équipe, forme ou rareté |
| 3.18 | 14 descriptions dépassent 160 caractères ; celles des fiches de personnage contiennent un saut de ligne brut | À FAIRE |
| 3.19 | `/equipe/[id]` n'a ni `openGraph`, ni `twitter`, ni JSON-LD, ni fil d'Ariane | À FAIRE |
| 3.20 | JSON-LD absent de 28 pages ; `ItemList` manquant sur 7 listes ; `BreadcrumbList` manquant sur 8 fiches ; ni `/skill/<id>` ni `/item/<id>` ne décrivent leur entité (2 670 pages) | À FAIRE |
| 3.21 | **hreflang totalement absent** : `<html lang="fr">` était figé, la langue vit dans le stockage local, une seule URL sert trois langues → les contenus anglais et japonais sont invisibles des moteurs | Partiellement FAIT (`lang` suit la langue choisie) — segments d'URL par langue À FAIRE |
| 3.22 | `lastModified: new Date()` sur toutes les pages statiques : le plan de site annonce à chaque appel que 90 URLs viennent d'être modifiées, et rejoue 7 requêtes pour 1,6 Mo sans cache | À FAIRE |
| 3.23 | 69 % des URLs à la même priorité (0,8) : le signal est plat, donc inutile | À FAIRE |
| 3.24 | `/login`, `/settings`, `/auth/*` déclarent `index, follow` (seul le fichier robots les protège, ce qui n'empêche pas l'indexation par lien externe) | À FAIRE |

## 4. Images et performance

| # | Constat | Statut |
|---|---|---|
| 4.1 | 16 `<Image fill>` sans `sizes` : le navigateur retient le candidat `100vw` | À FAIRE |
| 4.2 | Aucun `priority` sur les 12 listes principales : la première image visible est en chargement différé | À FAIRE |
| 4.3 | 10 visuels de contenu portent `alt=""` (couvertures d'article, portraits de personnage) | À FAIRE |
| 4.4 | `/passive` = 2,79 Mo de HTML pour 1 716 liens **sans pagination** ; `/chara` = 2,51 Mo | À FAIRE |
| 4.5 | L'image de partage par défaut pèse 532 Ko pour 1200×630 | À FAIRE |

## 5. Uniformisation des pages de liste

Le standard est établi par `/chara` (résolution serveur + îlot client, chips de filtres
actifs, superposition de chargement, pagination + densité), `/skill` (tri et filtre par
plage) et `/passive` (barre d'outils collante, sections titrées, compteur `aria-live`).
Côté médias, `MediaShell` factorise déjà entête, sous-navigation, compteur et état vide.

| # | Constat | Statut |
|---|---|---|
| 5.1 | **Auras : double pagination** — le serveur renvoyait 48 entrées puis le client repaginait ces 48 : chaque catégorie était plafonnée à 48 auras, les suivantes inatteignables | **FAIT** |
| 5.2 | `/sons` tronque à 400 entrées avec un message d'excuse, et n'a aucun état vide de recherche | À FAIRE |
| 5.3 | `/item` : la page n'a **aucun titre visible** (`sr-only`) | À FAIRE |
| 5.4 | `ItemCard` reçoit rareté et prix puis les jette : la grille des objets n'affiche ni l'une ni l'autre | À FAIRE |
| 5.5 | `FadeInItem` pose `opacity: 0` au rendu serveur et ne le lève qu'en JavaScript : **13 grilles sont invisibles sans JS**, et `prefers-reduced-motion` ne neutralise que la transition | À FAIRE |
| 5.6 | Tri absent de 22 listes sur 24 ; pagination absente de 16 ; squelette absent de 17 | À FAIRE |
| 5.7 | Pages sans aucun outillage : `/invocation` (rien), `/boutique` (ni recherche ni filtre ni tri ni pagination), `/stade`, `/equipe` (208 cartes d'un bloc, filtres hors URL), `/quete` (182 d'un bloc), `/drops` (5 filtres hors URL) | À FAIRE |
| 5.8 | 8 champs de recherche réimplémentés pour 11 usages du composant partagé ; 9 jeux d'onglets pour 2 usages de `FilterChips` ; 3 familles d'états vides ; 13 copies de la ligne de compteur ; 2 paginations maison | À FAIRE |
| 5.9 | `@rosegriffon/ui` quasi absent des listes (2 imports sur 24 pages) alors que `Tabs`, `Badge`, `Empty`, `Select`, `PaginationControls` existent | À FAIRE |
| 5.10 | 8 gabarits de `h1` différents pour 24 pages ; deux échelles typographiques concurrentes ; 240 occurrences de `text-[10px]`/`text-[11px]` hors échelle | À FAIRE |
| 5.11 | Couleurs hors tokens dans 10 composants (`bg-amber-500/10`, `bg-slate-600`, `bg-neutral-950`…), dont `rarity-badge.tsx` qui propage la dérive à tout le wiki, et `AuraCard` qui impose un fond sombre en dur (illisible en thème clair) | À FAIRE |
| 5.12 | 4 grilles restent à une colonne jusqu'à 768 px ; le rail d'arborescence de `/cpk` n'est jamais masqué (110 px restants sur un écran de 375 px) | À FAIRE |
| 5.13 | `/textures` n'a aucune recherche pour 53 126 fichiers | À FAIRE |
| 5.14 | Les compteurs des filtres de `/skill` sont forcés à zéro (« désactivés pour la performance ») | À FAIRE |
| 5.15 | `FadeInStagger` présent sur 13 grilles, absent de 9 autres : deux régimes visuels dans le même wiki | À FAIRE |

## 6. Uniformisation des fiches

Le standard est `/chara/[id]` : résolution d'identité à trois niveaux, statistiques
recalculées quand la base ne porte que les niveaux 1 et 99, panoplie repliée par
évolution, deux blocs JSON-LD, carte de partage générée, et une section par relation
existante.

| # | Constat | Statut |
|---|---|---|
| 6.1 | Fil d'Ariane : 3 implémentations, 10 copies en ligne, 3 fiches sans aucun ; le composant `Breadcrumb` partagé n'est importé nulle part | À FAIRE |
| 6.2 | Précédent/suivant : 3 designs, dont **un mort** (les pilules d'aura reçoivent toujours `null`) et un jamais alimenté (les chevrons de la fiche de personnage) | À FAIRE |
| 6.3 | Rareté : 4 vocabulaires concurrents, dont un tableau qui affiche « Normal » pour trois raretés distinctes | À FAIRE |
| 6.4 | Noms de boutiques : 3 tables contradictoires (« Marché des Esprits » / « Marché aux esprits ») ; catégories d'objets : 5 vocabulaires pour la même clé | À FAIRE |
| 6.5 | Descriptions : 3 politiques (fr/en/ja, fr+ja, fr seul) alors que l'anglais est en base | À FAIRE |
| 6.6 | Unités : trois notations pour deux durées de même nature | À FAIRE |
| 6.7 | Champs chargés puis jetés : `recastTime`, `partnerIds` et `description_en` (tactique) ; `gender`, `elementKanji`, `image` (entraîneur) ; `effect_params`, `text_raw` (passif) ; `rarity` (effectif d'équipe) ; `thumb` (stade) | À FAIRE |
| 6.8 | Squelette et limite d'erreur sur 5 fiches seulement ; bouton de partage sur une seule (enfoui dans le lecteur vidéo) | À FAIRE |
| 6.9 | 13 doublons à remonter en composants partagés : ligne clé/valeur, carte précédent/suivant, fil d'Ariane, badges, tables d'éléments (14 définitions), tables de postes (6), catégories d'objets (7), noms de boutiques (3), limite d'erreur, tuile liée, bloc de téléchargement | À FAIRE |
| 6.10 | `/equipe/[id]` affiche les valeurs brutes (`DF`, `Fire`) là où `/chara` traduit | À FAIRE |

## 7. Données manquantes et sources

Mesures sur le miroir du 14/8/2026. **Ne jamais fabriquer un libellé** : une donnée
absente doit être déclarée absente.

| # | Trou mesuré | Source vérifiée | Statut |
|---|---|---|---|
| 7.1 | 169 quêtes sur 182 portent une illustration jamais rendue (la bibliothèque la déclare « non résolue sur le CDN », la fiche affiche le **nom de fichier en texte**) | Le CDN la sert déjà : `cdn.rosegriffon.fr/dx11/menu/220_img/quest_img/<image>.png`, vérifié par requête réelle | À FAIRE — aucun coût d'extraction |
| 7.2 | 356 lignes de boutique sans nom français | `name_hash` résout dans l'index de texte du jeu (catégorie `shop`), 13 enseignes sur 15 | À FAIRE — aucun coût d'extraction |
| 7.3 | `inagle_formations` : **0 ligne** | `niers` : `export_formations` produit **115 formations, 1 073 placements**, depuis `formation_config_0.02.16.cfg.bin`. 89 noms et 83 descriptions se résolvent dans l'index de texte (« F-Chevaliers Noirs », « F-Voie Lactée ») ; chaque poste porte son rôle, son numéro de passe et **trois** jeux de coordonnées (coup d'envoi, attaque, défense) | À FAIRE — matière pour une section `/formation` avec terrain dessiné |
| 7.4 | 740 lots de capsule sur 740 affichés en hexadécimal brut | `data/common/gamedata/capsule/capsule_config_0.00.00.cfg.bin` (238 864 o, lisible par `niers vfs`) — seule source possible, ne résout ni en base ni dans l'index de texte | À FAIRE — parseur à écrire |
| 7.5 | 1 090 lignes de boutique (46,8 %) affichées « Objet 0x… » ; 1 368 objets (82 %) sans description | `data/common/text/<langue>/item_text.cfg.bin`. Le vocabulaire est présent dans l'index de texte (2 423 entrées, 712 orphelines) : c'est **l'appariement** identifiant → hash qui manque, et il vient de la configuration objet | À FAIRE |
| 7.6 | 540 costumes affichés par hash de modèle | `chara_costume_1.02.28.00.cfg.bin` + résolution par `niers uniform-map` | À FAIRE |
| 7.7 | 54 taux de drop sur 177 affichés « Inconnu » (tous en drop d'esprit) | `item_id` est nul en base : le parseur n'a pas résolu la cible, re-parsing requis | À FAIRE |
| 7.8 | `inagle_drops_treasures` : 0 ligne | `data/common/gamedata/map/*/*_item_table_config_*.cfg.bin` repérés dans l'index CPK | À FAIRE |
| 7.9 | Uniformes d'équipe : `data.uniforms` vide alors que `inagle_uniforms` (384) est déjà clé par le CRC des tenues | Jointure existante, à câbler | À FAIRE |
| 7.10 | Les 81 stades s'appellent « Terrain N » | **Aucune source** : aucun nom en base, aucun hash correspondant dans les 70 930 entrées de l'index de texte | **SANS SUITE** — à déclarer sans nom |
| 7.11 | Descriptions d'équipe : 100 % absentes | **Aucune source** : ni colonne, ni JSON, ni index de texte | **SANS SUITE** |
| 7.12 | Portraits d'entraîneur : 102 sur 102 sans image | Les visages existent côté CDN, mais **aucune clé de jointure** vers un code de personnage n'a été trouvée | À FAIRE — trouver la clé avant toute mise en œuvre |
| 7.13 | `inagle_passives` (128 lignes) et `passives-full.json` (1 716) sont deux espaces d'identifiants **disjoints** : le repli qui cherche l'image d'un passif ne peut jamais aboutir | À FAIRE |
| 7.14 | Colonnes jamais alimentées (100 % à zéro, pas nulles) : `rarity`, `sell_price`, `effect_value` sur les objets | À FAIRE — à retirer plutôt qu'à combler |

---

## Ordre d'exécution conseillé

1. **Ce qui trompe les moteurs ou casse une page** — reste de §3.10 à §3.15, §2.5, §2.6, §2.9, §5.2 à §5.5.
2. **Le socle partagé** — §6.9 (les 13 doublons) puis §5.8 : tout le reste de l'uniformisation en dépend.
3. **Uniformisation des listes** (§5.6, §5.7, §5.10, §5.11) puis des fiches (§6.1 à §6.8).
4. **Comblement des données sans extraction** — §7.1 et §7.2 (gain immédiat).
5. **Extractions par `niers`** — §7.3 (formations, la plus rentable : une section entière),
   puis §7.4, §7.5, §7.6.
6. **Chantiers de fond** — §3.21 (langues dans l'URL), §4.4 (poids des listes), §1.10.

## Rappels d'exécution

- Déploiement : `bun run deploy azalee` (bleu/vert, sans coupure) ; un correctif commité
  n'est pas livré.
- Vérification : le code de statut compte autant que le rendu — `curl -s -o /dev/null -w
  '%{http_code}'` sur une entité inexistante doit répondre 404.
- Toute donnée de jeu affichée doit être adossée au dump ou au miroir. En l'absence de
  source, écrire que la donnée n'existe pas.
