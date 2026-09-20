# Achilléa → `apps/website` — plan de migration du front

Plan d'exécution pour absorber **`apps/achillea-web` (Angular 21 + PrimeNG)** dans
**`apps/website` (Next 16 + React 19 + `@rose-griffon/ui`)**, de sorte que
`rosegriffon.fr` devienne l'unique site du réseau : portail, wiki Azalée et
Achilléa compétitif.

> Statut : **plan**. Aucune étape n'est exécutée par ce document. Il prolonge
> `docs/achillea-modulaire.md` (§ « Prochaine étape si l'on migre le front ») et
> ne redit pas ce qui y est déjà décrit. Contexte d'intégration :
> `docs/achillea.md`. Services et ports : `docs/achillea-services.md`.

---

## 1. Ce qui existe déjà et ne doit PAS être recréé

C'est le point décisif : **les trois couches basses sont déjà portées, typées,
testées et branchées sur `apps/website`.** La migration n'est pas une
réécriture d'application, c'est le remplacement d'un adaptateur d'affichage.

| Brique existante | Emplacement | Ce qu'elle couvre déjà |
| --- | --- | --- |
| Contrat pur | `packages/achillea-types` | DTO, enums, domaine. Zéro dépendance. Regénère JSON Schema/Rust/Swift/Kotlin via `bun run achillea:contract`. |
| Métier multi-runtime | `packages/achillea-core` | 24 modules : `elo`, `ranking`, `brackets`, `tournaments`, `clans`, `casts`, `licenses`, `sanctions`, `wallet`, `access`, `format`, `labels`, `presentation`, `validation`… Interdit d'y toucher depuis le front. |
| Client HTTP isomorphe | `packages/achillea-client` | `AchilleaClient` + **16 ressources** (`admin`, `auth`, `casts`, `clans`, `guilds`, `leagues`, `licenses`, `notifications`, `organizations`, `playerNotes`, `ranked`, `sanctions`, `stats`, `tournaments`, `users`, `wallet`). Ne lève jamais : rend `{ ok, … }`. Fonctionne en RSC, en route handler et en îlot client. |
| Adaptateur Next | `apps/website/src/lib/achillea/` | `createAchilleaClient()`, `achilleaApiUrl()`, `tone.ts` (mapping tons → variantes de badge), ré-exports `core`/`types`. Tests : `apps/website/src/lib/achillea/achillea.test.ts`. |
| Dépendances déclarées | `apps/website/package.json` | `@rosegriffon/achillea-{client,core,types}` sont **déjà** en `workspace:*`. Rien à installer. |
| Route publique | `apps/website/src/app/api/public/achillea/info/route.ts` | Première consommation en production. |
| Entrée visuelle | `apps/website/src/components/home/AchilleaBanner.tsx` | Bloc Achilléa de la home unifiée. |
| Design system | `packages/ui` (58 composants MD3) | Remplace PrimeNG. Tokens FR : `succes`, `alerte`, `info` — jamais `success`/`warning`. |
| Chrome partagé | `packages/app-shell` | Navigation unique paramétrée par `NavBases`. C'est là qu'on ajoute l'entrée Achilléa, **pas** dans `apps/*/config/navigation.ts`. |

**Corollaire** : les ~4 746 lignes de `apps/achillea-web/src/app/shared/services/**`
(16 services Angular) et les 35 modèles de `core/models/**` n'ont plus de logique
métier à sauver — ce sont des appels HTTP et de la mise en forme que `client` +
`core` couvrent déjà. Elles sont **supprimées**, pas portées.

### Inventaire à porter (le vrai périmètre)

`apps/achillea-web/src/app/views` + `shared/components` = **35 394 lignes**
(138 `.ts`, 78 `.html`, 62 `.css`), soit 29 vues et 30 composants partagés.

| Vue | LOC | Vue | LOC |
| --- | ---: | --- | ---: |
| `admin-dashboard` | 4961 | `clan-dashboard` | 305 |
| `tournament-page` | 3909 | `clans-list` | 297 |
| `asytral-league` | 2740 | `cast-planning` | 264 |
| `homepage` | 2284 | `ranked-tiers` | 238 |
| `tournament-ranking` | 1368 | `clan-profile` | 175 |
| `clan-creation` | 885 | `wallet` | 170 |
| `ranked-match` | 826 | `ranked-challenge` | 148 |
| `guide` | 804 | `licence` | 115 |
| `user-profile` | 681 | `licence-verify` | 99 |
| `ranked` | 542 | `cast-availability` | 95 |
| `ranked-leaderboard` | 469 | `organization-validation` | 91 |
| `ranked-history` | 353 | `auth-page` | 76 |
| | | `casts-public` + 4 vues triviales | < 60 chacune |

---

## 2. Cible : plan de routes

Préfixe `/achillea` dans `apps/website/src/app/achillea/**`. `achillea.rosegriffon.fr`
redirige ensuite en **301** vers ces chemins (même schéma que
`azalee.rosegriffon.fr` → `/wiki`, déjà éprouvé).

| Angular (`app.routes.ts`) | Next (`apps/website/src/app/achillea/…`) | Rendu | Garde |
| --- | --- | --- | --- |
| `""` | `page.tsx` | RSC + ISR | — |
| `auth` | `(auth)/connexion/page.tsx` | — | *fusionné avec l'auth du site* |
| `clans` | `clans/page.tsx` | RSC | — |
| `clans/create` | `clans/creation/page.tsx` | client | session |
| `clans/dashboard` | `clans/tableau-de-bord/page.tsx` | client | rôle ≥ `SubCaptain` |
| `clans/:id` | `clans/[id]/page.tsx` | RSC | — |
| `users/:id` | `joueurs/[id]/page.tsx` | RSC | — |
| `events/create/tournament` | `tournois/creation/page.tsx` | client | session |
| `events/list/tournament` | `tournois/page.tsx` | RSC | — |
| `events/tournaments/:id` | `tournois/[id]/page.tsx` | RSC + îlots | — |
| `events/tournaments/circuit/ranking` | `tournois/circuit/classement/page.tsx` | RSC | — |
| `leagues/astral` (+3 alias) | `ligues/astral/page.tsx` (+ `redirects` Next) | RSC | — |
| `organizations/create` | `organisations/creation/page.tsx` | client | session |
| `ranked` | `ranked/page.tsx` | client | session |
| `ranked/tiers` | `ranked/paliers/page.tsx` | statique | — |
| `ranked/leaderboard` | `ranked/classement/page.tsx` | RSC + ISR 60 s | — |
| `ranked/history` | `ranked/historique/page.tsx` | client | session |
| `ranked/match` | `ranked/match/page.tsx` | client (temps réel) | session |
| `ranked/defi/:code` | `ranked/defi/[code]/page.tsx` | client | — |
| `licence` | `licence/page.tsx` | client | session |
| `licence/verify/:qr` | `licence/verification/[qr]/page.tsx` | RSC | — |
| `wallet` | `portefeuille/page.tsx` | client | session |
| `casts` | `casts/page.tsx` | RSC | — |
| `casts/:tournamentId/availability` | `casts/[tournoi]/disponibilites/page.tsx` | client | session |
| `casts/:tournamentId/planning` | `casts/[tournoi]/planning/page.tsx` | client | Administrator |
| `admins/dashboard` | `admin/page.tsx` | client | Moderator+ |
| `admins/sanctions` | `admin/sanctions/page.tsx` | client | Administrator |
| `admins/ranked-disputes` | `admin/litiges/page.tsx` | client | Administrator |
| `admins/dashboard/organizations/validate/:id` | `admin/organisations/[id]/page.tsx` | client | Administrator |
| `guide`, `guide/brand` | `guide/page.tsx`, `guide/marque/page.tsx` | statique | — |
| `forbidden`, `not-found`, `**` | `forbidden/page.tsx`, `not-found.tsx` | statique | — |

**Les anciennes URL doivent survivre.** Tout chemin Angular listé ci-dessus reçoit
une entrée dans `next.config` (`redirects()`), permanente, avec la vue
correspondante. Un tableau de correspondance non exhaustif = régression SEO.

---

## 3. Correspondance des mécanismes Angular → Next

| Angular | Cible Next | Note |
| --- | --- | --- |
| `loadComponent` + lazy route | segment `app/achillea/**` | découpage automatique |
| `canActivate: [authGuard]` | vérification de session en RSC + `redirect()` | plus de garde côté client seul |
| `canActivate: [userRoleGuard(x)]` | `access` de `@rosegriffon/achillea-core` | la règle existe déjà, ne pas la réécrire |
| `canActivate: [inClanGuard(role)]` / `clanGuard` | idem, via `clans` + `access` | idem |
| `AuthSessionService` (signals) | session `@rosegriffon/auth` + `getAuthToken` du client | voir §4 |
| 16 `*-service.ts` (RxJS/HttpClient) | `createAchilleaClient().<ressource>` | **supprimés** |
| `core/models/*.ts` (35) | `@rosegriffon/achillea-types` | **supprimés** |
| `api-base-url.interceptor.ts` | `baseUrl` du client | supprimé |
| PrimeNG (`p-table`, `p-dialog`, `p-select`…) | `packages/ui` (Table, Dialog, Select, Tabs…) | 1 pour 1 sur l'essentiel ; les manquants s'ajoutent à `packages/ui`, jamais en local |
| `brackets-viewer` | conservé, monté dans un îlot `"use client"` | lib DOM impérative, pas de portage |
| `ngx-translate` + `src/assets/i18n/fr.json` (202 clés) | provider de langue existant (`providers/language-provider.tsx`) | le fichier de clés est **repris tel quel** |
| `ngx-lottie` / `lottie-web` | `lottie-web` dans un îlot client | dépendance conservée |
| `socket.io-client` (notifications) | îlot client + hook `useNotifications` | dernier lot, cf. §5 phase 4 |
| `@colyseus/sdk` (`ranked-room-service`) | îlot client dédié `ranked/match` | idem — seul endroit où Angular n'est pas un simple adaptateur |
| `environment.ts` / `achillea-config.js` (runtime) | `NEXT_PUBLIC_ACHILLEA_API_URL` + variantes | ⚠️ `NEXT_PUBLIC_*` inliné au **build** : lancer `bun run deploy website` depuis `apps/website`, jamais depuis la racine |
| `@casl/ability` | `access` de `achillea-core` | à vérifier vue par vue ; si un cas manque, il va dans `core`, pas dans l'app |

---

## 4. Le point dur : l'authentification

Deux systèmes cohabitent aujourd'hui.

- `apps/website` : `@rosegriffon/auth` (better-auth) + Supabase self-host,
  cookie de session sur `rosegriffon.fr`.
- `apps/achillea-web` : `AuthSessionService`, jeton porté vers l'API Achilléa
  (`ranked.rosegriffon.fr`, via `api.rosegriffon.fr/achillea/`), plus un
  **jeton temps réel** distinct (`getRealtimeToken`, marge de renouvellement
  30 s) pour Socket.IO et Colyseus.

**Décision à prendre avant la phase 2** (elle conditionne tout le reste) :

1. **Pont de jetons (recommandé, réversible)** — la session `rosegriffon.fr`
   fait foi ; une route handler `/api/achillea/token` échange le cookie contre
   un jeton Achilléa côté serveur et ne l'expose jamais au navigateur pour les
   appels RSC. Les îlots client reçoivent un jeton court via la même route.
   Aucun changement côté API Achilléa hormis l'acceptation de l'émetteur.
2. **Unification complète des comptes** — un seul utilisateur, une seule base.
   Meilleur résultat final, mais demande une migration de données et touche
   `achillea-bot` : hors périmètre de ce plan.

Le reste du plan suppose l'option 1. `safeReturnUrl()` de
`core/auth/auth-session.service.ts` est la seule fonction de ce fichier à
conserver — elle part dans `apps/website/src/lib/achillea/`.

---

## 5. Phases, chacune livrable et réversible

Ordre choisi pour que **rien ne casse à aucun moment** : `apps/achillea-web`
reste en production et servi par `achillea.rosegriffon.fr` jusqu'à la phase 5.
Les deux fronts coexistent sur la même API.

### Phase 0 — socle (sans écran)
- `apps/website/src/app/achillea/layout.tsx` : chrome Achilléa via `app-shell`,
  entrée de navigation ajoutée dans `NavBases`.
- Reprise de `src/assets/i18n/fr.json` et des assets `public/` d'Achilléa.
- Thème : vérifier que les 4 thèmes déclarent le même jeu de variables
  (`packages/ui/test/tokens.test.ts`) après ajout éventuel de tokens Achilléa.
- **Gate** : `type-check` + `build` + `bun test packages/ui packages/app-shell`.

### Phase 1 — écrans en lecture seule (≈ 6 200 LOC source)
`clans`, `clans/[id]`, `joueurs/[id]`, `tournois`, `tournois/[id]`,
`tournois/circuit/classement`, `ligues/astral`, `ranked/classement`,
`ranked/paliers`, `casts`, `guide`, `licence/verification/[qr]`, `forbidden`,
`not-found`.
Ne dépendent que de `client` + `core`, déjà branchés et testés. Server
Components, ISR court sur ce qui bouge (classements : 60 s).
- **Gate** : parité de données prouvée — un test qui compare, pour un même
  identifiant, la réponse de l'API et ce que la page rend (comptes, ordre,
  libellés) ; plus `bun run build` et les tests de liens
  (`packages/app-shell/test/liens.test.ts`, `sidebar-config.test.ts`) qui
  refuseront toute entrée de menu sans page.

### Phase 2 — authentification + écrans de session (≈ 3 000 LOC)
Pont de jetons (§4), puis `ranked`, `ranked/historique`, `licence`,
`portefeuille`, `clans/creation`, `clans/tableau-de-bord`,
`organisations/creation`, `tournois/creation`,
`casts/[tournoi]/disponibilites`.
- **Gate** : chaque garde Angular a son équivalent testé (un utilisateur sans
  rôle est refusé côté **serveur**, pas seulement masqué côté client).

### Phase 3 — administration (≈ 5 400 LOC)
`admin`, `admin/sanctions`, `admin/litiges`, `admin/organisations/[id]`,
`casts/[tournoi]/planning`. Le plus gros bloc (`admin-dashboard` = 4 961 LOC à
lui seul) : à découper en sous-lots par onglet.
- **Gate** : les actions sensibles restent refusées côté API même si l'UI les
  expose (c'est déjà la règle dans `app.routes.ts`, elle ne doit pas se
  relâcher).

### Phase 4 — temps réel (≈ 1 000 LOC)
`ranked/match`, `ranked/defi/[code]`, notifications Socket.IO. Îlots
`"use client"` exclusivement. Jeton temps réel dédié, renouvellement conservé.
- **Gate** : un match ranked complet joué de bout en bout sur le nouveau front,
  avec reconnexion forcée en cours de route.

### Phase 5 — bascule et retrait
1. `achillea.rosegriffon.fr` → **301** vers `rosegriffon.fr/achillea/*`
   (`infra/nginx/achillea.rosegriffon.conf`), redirections de chemins en place.
2. Période d'observation avec les deux fronts encore déployables.
3. Retrait : `apps/achillea-web`, son entrée d'espace de travail, ses ~20
   dépendances exclusives (`@angular/*`, `primeng`, `@primeuix/themes`,
   `primeicons`, `primelocale`, `zone.js`, `ngx-*`, `karma*`, `jasmine*`,
   `@types/jasmine`, `puppeteer`, `tailwindcss-primeui`, `@angular/build`,
   `@angular/cli`), `angular.json`, ses `tsconfig.*`, sa CI.
4. `@colyseus/sdk`, `socket.io-client`, `brackets-viewer`, `brackets-model`,
   `lottie-web`, `iso-639-1`, `valibot`, `@sindresorhus/transliterate` **ne
   sont pas** des dépendances Angular : elles déménagent vers `apps/website`
   (ou `packages/ui`) au moment où la phase qui les consomme atterrit.

**Ce qui n'est PAS touché** : `apps/achillea-bot`, l'API `:4000`/`:4002`, le
Socket.IO `:4005`, `ranked.rosegriffon.fr`, `achillea-auth.service`,
`achillea-postgrest.service`, `achillea-realtime.service`,
`achillea-storage.service`, la base Achilléa, ses migrations et ses secrets.
Ce plan ne déplace **que** le rendu.

---

## 6. Garde-fous permanents (hérités du `CLAUDE.md`)

- **Couches** : un DTO ou une règle métier qui réapparaît dans
  `apps/website/src/app/achillea/**` est une régression. Destination :
  `achillea-types` (contrat pur) ou `achillea-core` (métier).
- Toute modification de `packages/achillea-types` impose
  `bun run achillea:contract` ; la CI lance `achillea:contract:check`.
- Un export lu côté serveur ne doit jamais venir d'un module `"use client"` :
  crash au `build`, pas au `type-check`. Toujours `bun run build`, pas
  seulement `bun --filter @rosegriffon/website type-check`.
- Tokens de couleur FR (`succes`/`alerte`/`info`), overlays `bg-scrim/xx`.
- Biome peut revert un `Edit` sur `*.tsx` : vérifier au `grep` après coup.
- `bun.lock` en `lockfileVersion 1` (Bun 1.3.14) — ne pas régénérer avec un
  Bun 1.4-canary.
- Jamais de `rm -rf .next` sur une app servie par un service systemd.
- Déploiement : `bun run deploy website` (bleu/vert), un seul build à la fois.

## 7. Vérification à chaque phase

```bash
bun --filter @rosegriffon/website type-check
bun --filter @rosegriffon/achillea-types    type-check && bun --filter @rosegriffon/achillea-types    test
bun --filter @rosegriffon/achillea-core     type-check && bun --filter @rosegriffon/achillea-core     test
bun --filter @rosegriffon/achillea-client   type-check && bun --filter @rosegriffon/achillea-client   test
bun --filter @rosegriffon/achillea-contract check
bun test packages/app-shell/test packages/ui/test apps/website/src/lib/achillea
cd apps/website && bun run build
```

## 8. Risques, classés par coût d'une erreur

| Risque | Conséquence | Parade |
| --- | --- | --- |
| Authentification (§4) | Bloque les phases 2-4 ; une erreur expose des données | Trancher **avant** la phase 2 ; pont de jetons réversible |
| PrimeNG → `packages/ui` | 30 composants partagés à re-créer ; dérive visuelle | Combler les manques dans `packages/ui` (bénéficie aux 3 sites), jamais en local |
| URLs perdues | Régression SEO durable | Tableau de redirections exhaustif, vérifié par un test |
| `admin-dashboard` (4 961 LOC) | Lot ingérable | Découpage par onglet en phase 3 |
| Temps réel Colyseus/Socket.IO | Matchs ranked cassés | Dernier lot, front Angular encore déployable |
| `NEXT_PUBLIC_*` inliné | Front pointant sur la mauvaise API | Déployer depuis `apps/website` |
