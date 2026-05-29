# TypeScript Audit — `~/rg/` — 2026-05-17

## Synthèse

Le monorepo présente un niveau de type-safety solide pour un projet en développement actif. La génération de types Supabase est correcte et les helpers DB propagent bien `Database`. Les trois points les plus urgents sont : (1) le type `CookieStore.set` / `setAll` dans `@rose-griffon/db/server` est incompatible avec `SetCookie`/`SetAllCookies` de `@supabase/ssr` — le callsite du website le contourne avec `as Record<string, unknown>` ; (2) `tsyringe` est déclaré en dépendance du bot mais n'est pas utilisé (dead dep) ; (3) `ignoreDeprecations: "6.0"` masque activement des erreurs TS 6.0 qui devront être adressées lors du prochain cycle.

---

## @rose-griffon/db

### Strengths

- **`Database = { ... }` pattern correct.** La forme générée par `supabase gen types typescript` avec `__InternalSupabase: { PostgrestVersion: "14.5" }` est le pattern canonical de `@supabase/supabase-js` v2.105+. Le `DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">` avant d'en dériver `DefaultSchema` est la bonne approche.

- **Helpers typés strictement.** `createBrowserClient<Database>`, `createClient<Database>`, `createServerClient<Database>` propagent tous le type générique. `ReturnType<typeof createBrowserClient<Database>>` pour le singleton est correct — le type du client est inféré précisément depuis le générique.

- **Exports map propre.** Le `package.json` expose cinq entries (`"."`, `"./browser"`, `"./server"`, `"./service"`, `"./types"`) alignées sur les fichiers sources. Les apps peuvent importer `@rose-griffon/db/service` sans embarquer le SSR runtime Next.

- **`Tables<"tablename">`, `TablesInsert<>`, `TablesUpdate<>`, `Enums<>`, `CompositeTypes<>`** sont toutes exportées depuis `types.ts`. Ces utilitaires couvrent 100 % des accès colonne-safe que les app peuvent vouloir dériver.

- **Singleton `cachedClient` dans `service.ts`** : sûr pour le bot (processus Bun long-running). Pour le contexte Next.js, la documentation du package précise « Fluid compute friendly : nouveau client à chaque appel » dans le wrapper `createAdminClient()` du website — le singleton reste dans `@rose-griffon/db` mais le wrapper website appelle `createSupabaseServiceClient()` à chaque fois, ce qui re-retourne le singleton déjà initialisé (comportement correct, pas de risque HMR côté bot).

### Issues

**[MEDIUM] `CookieStore.set` et `setAll` — options typées trop largement.**

Dans `src/server.ts` :

```ts
interface CookieStore {
  getAll: () => Array<{ name: string; value: string }>;
  set?: (name: string, value: string, options?: Record<string, unknown>) => void;
}
// ... dans createServerClient :
setAll(cookiesToSet: Array<{ ...; options?: Record<string, unknown> }>) { ... }
```

`@supabase/ssr@0.6.1` définit :

```ts
type CookieOptions = Partial<SerializeOptions>; // from package "cookie"
type SetCookie = (name: string, value: string, options: CookieOptions) => void;
type SetAllCookies = (cookies: { name: string; value: string; options: CookieOptions }[]) => void;
```

`CookieOptions` (= `Partial<SerializeOptions>`) n'est **pas** assignable à `Record<string, unknown>` dans le sens inverse. Le callsite `createSupabaseServerClient` dans `apps/website/src/lib/supabase/server.ts` doit le contourner avec `options as Record<string, unknown>`. Ce cast silencieux est la preuve que la friction existe. Ce n'est pas une rupture runtime (les propriétés réelles de `CookieOptions` sont toujours transmises), mais c'est un mensonge de type.

**[LOW] `ReadonlyRequestCookies` de `next/headers` vs `CookieStore`.**

`ReadonlyRequestCookies` expose `getAll(): ResponseCookie[]` (avec des champs supplémentaires comme `path`, `domain`, `sameSite`, etc.), mais `CookieStore.getAll()` retourne `Array<{ name: string; value: string }>`. Le type est structurellement compatible en entrée (duck typing), mais la méthode `set` de `ReadonlyRequestCookies` accepte `(name, value, options?: CookieSerializeOptions)` ce qui diverge de `CookieStore.set?: (name, value, options?: Record<string, unknown>)`. Le wrapper website `apps/website/src/lib/supabase/server.ts` adapte correctement via une lambda — l'interface `CookieStore` est donc une surcouche volontaire. Pas de bug runtime.

**[LOW] `db` package tsconfig hérite de `tsconfig-base.json` (pas `tsconfig-bun.json`) mais déclare `"types": ["bun"]`.**

`process.env` dans `browser.ts`, `server.ts`, `service.ts` est résolu via le type `bun` (qui ré-exporte `NodeJS.ProcessEnv`). C'est cohérent. Mais `browser.ts` est sensé tourner côté browser Next.js, où `process.env` vient de webpack/Next (`@types/node`). Le type `bun` inclut `process`, donc ça compile — mais le package `@rose-griffon/db` pourrait un jour être consommé dans un contexte sans Bun. Risque faible, mais à noter si le package devient public.

**[INFO] Singleton `cachedClient` dans `browser.ts` — HMR Next.js.**

Le singleton module-level `let cachedClient` dans `browser.ts` peut survivre un HMR partiel en dev Next.js (le module n'est pas re-évalué si le fichier ne change pas). Ce n'est pas un bug — c'est le comportement documenté et souhaité (un seul client Supabase par tab). Aucune action requise.

### Recommendations

1. Remplacer `Record<string, unknown>` dans `CookieStore` par `CookieOptions` importé depuis `@supabase/ssr` :

```ts
import type { CookieOptions } from "@supabase/ssr";
interface CookieStore {
  getAll: () => Array<{ name: string; value: string }>;
  set?: (name: string, value: string, options?: CookieOptions) => void;
}
// setAll param :
setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>)
```

Ceci élimine le `as Record<string, unknown>` dans le wrapper website.

2. Envisager d'exporter `CookieStore` depuis `@rose-griffon/db/server` pour que les callers puissent typer leur cookieStore local sans reimporter `@supabase/ssr`.

---

## apps/bot

### Strengths

- **`reflect-metadata` en premier import dans `src/index.ts`.** C'est la contrainte critique de tsyringe/discordx — elle est respectée. `import "reflect-metadata"` est ligne 1, avant tout autre import.

- **Pas de `import type` sur les classes décorées discordx.** Les imports `Discord`, `Slash`, `SlashOption`, `SlashGroup`, `SlashChoice`, `Once`, `On` proviennent tous de `@rpbey/discordx` via import value (pas `import type`). Les classes discord.js comme `ChatInputCommandInteraction`, `User` qui ne servent qu'à l'annotation de type sont correctement importées avec `import type`. Le pattern est impeccable : seules les valeurs utilisées à runtime restent en import value.

- **Pattern double-DB explicitement documenté et justifié.** `lib/db.ts` documente les deux paths (Supabase builder pour queries simples, `Bun.SQL` pour CTEs/agrégats). La séparation est propre et les services respectent le split.

- **Zéro `any` dans tout le code bot.** `rg` strict `noImplicitAny: true` est respecté — grep sur `any` ne retourne aucun hit dans `src/`.

- **`RgRole` comme union string literal.** `"admin" | "staff" | "moderator" | "premium" | "user" | "banned"` est bien typé, utilisé dans `rbac.ts` et repris comme `(typeof VALID_ROLES)[number]` dans `commands/admin/user.ts`. Bonne pratique.

- **`withRgAdmin` typé avec `Args extends unknown[]`.** La fonction higher-order est générique sur les args, ce qui préserve la variante des handlers. Pas d'`any` sur les args passthrough.

- **Interfaces SQL explicites sur toutes les queries.** `sql<AdminStats[]>`, `sql<AdminUserRow[]>`, `sql<MemberRow[]>`, etc. — 100 % des queries `Bun.SQL` sont typées avec un type de retour explicite.

- **`SyncReport`, `StaffPhotoSyncReport` — error arrays typés.** `errors: { discordId: string; reason: string }[]` avec `reason: err instanceof Error ? err.message : String(err)` — bon pattern de surface d'erreur structurée.

- **Canvas — `SKRSContext2D` depuis `@aphrody-code/canvas`.** `utils.ts` importe le type correct au lieu d'utiliser `CanvasRenderingContext2D` du DOM. `cards.ts` utilise `ReturnType<ReturnType<typeof createCanvas>["getContext"]>` pour le context — verbeux mais fonctionnel.

### Issues

**[HIGH] `tsyringe` en dépendance mais non utilisé dans le code.**

`package.json` déclare `"tsyringe": "catalog:"` en `dependencies`. Aucun fichier dans `src/` ne contient `@Injectable`, `@Singleton`, `container.`, ou `inject`. C'est une dead dependency qui alourdit le bundle et peut créer de la confusion. À retirer.

**[MEDIUM] `SettingRow.value: unknown` — pas de type guard à l'usage.**

```ts
export interface SettingRow {
	value: unknown; // JSONB
}
```

Dans `commands/admin/settings.ts`, `fmtValue(row.value)` convertit `unknown` en string via `JSON.stringify` — OK. Mais `setSetting(key, parsed, description)` avec `parsed: unknown` puis `JSON.stringify(value)::jsonb` fonctionne. Le problème est que les callers de `getSetting<T>` dans `services/website.ts` utilisent le générique sans validation :

```ts
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
	const rows = await sql<{ value: T }[]>`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
	return rows[0]?.value ?? null;
}
```

Le `T` est un paramètre fantôme — `Bun.SQL` ne valide pas le shape au runtime. `getSetting<number>("max_articles")` retourne en fait `unknown` casté en `number` sans vérification. Acceptable si le DB schema est la source de vérité, mais trompeur.

**[MEDIUM] `GUILD_ID` dupliqué dans 3 fichiers.**

`src/index.ts`, `src/events/ready.ts`, `src/events/memberEvents.ts` lisent tous `Bun.env.GUILD_ID` indépendamment. La valeur est lue 3 fois à module init. Si la variable n'est pas définie, le comportement diverge selon l'ordre d'initialisation des modules. Centraliser dans un `lib/config.ts` élimine la duplication et permet un fail-fast unique.

**[MEDIUM] `raw as unknown as string` dans `lib/cache.ts`.**

```ts
return JSON.parse(raw as unknown as string) as T;
```

`Bun.RedisClient.get()` retourne `Promise<string | null>` (confirmé dans `bun-types@1.3.14/redis.d.ts` ligne 118). Le cast `as unknown as string` est donc inutile — `raw` est déjà `string | null`, et le guard `raw !== null && raw !== undefined` affine déjà à `string`. Le `as unknown as string` est probablement un vestige d'une version antérieure des types Bun où `get()` retournait `Buffer | string | null`. Simplifier en `JSON.parse(raw) as T`.

**[LOW] Non-null assertion `row!` dans `getAdminStats()`.**

```ts
const [row] = await sql<AdminStats[]>`SELECT ... 10 scalar subqueries ...`;
return row!;
```

Cette query retourne exactement une ligne (10 sous-requêtes scalaires sans FROM), donc `row!` est correct. Mais l'assertion silencieuse masque un bug potentiel si la query était modifiée. Un throw explicite serait plus robuste :

```ts
if (!row) throw new Error("[admin] stats query returned no rows");
return row;
```

**[LOW] Magic numbers dans `lib/embeds.ts`.**

`RG_COLOR = 0xa14b3f` est un magic number hexadécimal. C'est aussi dans `RG_THEME.brand = "#a14b3f"` dans `canvas/theme.ts` — deux sources de vérité pour la même couleur marque. Si la charte graphique évolue, le changement doit être fait en deux endroits.

**[LOW] `teamPhotos.ts` — fonction `avatarUrl` réimplémentée localement.**

```ts
function avatarUrl(
	user: { id: string; avatar: string | null; discriminator: string },
	size = 256
): string;
```

discord.js expose `user.avatarURL({ size, extension: "webp" })` qui gère cela nativement (y compris les avatars animés `a_*`). `syncMembers.ts` utilise bien `member.avatarURL(...)`. `teamPhotos.ts` réimplémente la logique manuellement via `client.users.fetch()` puis accède à `user.avatar` (hash brut). La réimplémentation est correcte mais introduit de la divergence : si Discord change son CDN URL pattern, il faudra patcher à deux endroits.

**[INFO] `api.ts` — `return body as T` sans validation.**

```ts
async function request<T>(...): Promise<T> {
  ...
  return body as T;
}
```

Pattern standard pour un client HTTP interne. Acceptable si l'API website est sous contrôle. Mais `BotApiError` est correctement typée avec `status: number` et `body?: unknown` — bonne pratique.

### Recommendations

1. Retirer `tsyringe` des dependencies de `apps/bot/package.json` (dead dep).
2. Créer `src/lib/config.ts` avec les constantes d'env fail-fast :

```ts
export const GUILD_ID =
	Bun.env.GUILD_ID ??
	(() => {
		throw new Error("GUILD_ID required");
	})();
// ou en optional si le bot peut tourner sans guild :
export const GUILD_ID = Bun.env.GUILD_ID;
```

3. Simplifier `cache.ts` ligne 59 : `JSON.parse(raw) as T` (pas de double cast).
4. Unifier `RG_COLOR` et `RG_THEME.brand` — soit `RG_COLOR = parseInt(RG_THEME.brand.slice(1), 16)` ou `RG_THEME.brand = "#" + RG_COLOR.toString(16)`.

---

## Risques TS 6 / TS 7 (forward-looking)

**`ignoreDeprecations: "6.0"` dans `tsconfig-base.json`.**

Ce flag dit au compilateur "ignore les erreurs marquées deprecated depuis TS 6.0". Les deprecations TS 6.0 concernaient principalement :

- `--target` + `--lib` combinaisons obsolètes
- `moduleResolution: "bundler"` interaction avec certaines options

Le flag est propagé à tous les packages via héritage. Quand le flag sera retiré (TS 7 probablement), les erreurs masquées remonteront toutes en même temps. Recommandé : activer `"ignoreDeprecations": false` sur une branche et traiter les warnings avant TS 7.

**`experimentalDecorators: true` + TS 6.x.**

TS 5.0 a introduit les Stage 3 decorators standardisés (TC39). `experimentalDecorators: true` active l'ancienne implémentation TS custom. `discordx` et `tsyringe` utilisent le vieux mécanisme. TS 6 maintient la rétrocompatibilité via `experimentalDecorators`, mais TS 7 pourrait le déprécier ou le retirer. Le risque est moyen : si `@rpbey/discordx` ne migre pas vers Stage 3 decorators, le bot sera bloqué sur TS 5.x/6.x. Suivre les issues discordx upstream.

**`useDefineForClassFields: false` dans `tsconfig-bun.json`.**

Requis pour que `emitDecoratorMetadata` fonctionne correctement (les field initializers TS legacy vs TC39). Bun 1.x respecte ce flag. Si Bun renforce son alignement TC39, ce flag pourrait devenir sans effet. À surveiller avec les Bun changelogs.

**`noUncheckedIndexedAccess` et `exactOptionalPropertyTypes` absents de `tsconfig-base.json`.**

`packages/patreon-bun` les active dans son propre tsconfig (ils sont opt-in). Le bot et `@rose-griffon/db` ne les ont pas. Sans `noUncheckedIndexedAccess`, `array[i]` retourne `T` au lieu de `T | undefined`, ce qui masque des bugs d'index out-of-bounds. Les accès `members[i]!` dans `cards.ts` et `rows[0]!` dans les services existent précisément parce que le flag est absent — avec le flag activé, ils seraient correctement reportés par le compilateur.

**TypeScript 6.0 — `verbatimModuleSyntax` non activé.**

`verbatimModuleSyntax: false` (défaut implicite). L'activer forcerait l'utilisation de `import type` systématiquement pour les imports purement de types. Recommandation pour le bot : **ne pas l'activer**. Le bot utilise `emitDecoratorMetadata` qui nécessite que les types de paramètres soient émis via `Reflect.metadata("design:paramtypes", ...)`. Avec `verbatimModuleSyntax: true`, les imports marqués `import type` sont élidés à la transpilation, ce qui peut briser la chaîne de métadonnées dans certains edge-cases. Pour `@rose-griffon/db` et les apps Next.js, l'activation est sans risque et recommandée.

---

## Top 5 Action Items

### 1. Corriger `CookieStore` dans `@rose-griffon/db/server.ts`

**Fichier :** `/home/ubuntu/rg/packages/db/src/server.ts`

```ts
import type { CookieOptions } from "@supabase/ssr";

interface CookieStore {
  getAll: () => Array<{ name: string; value: string }>;
  set?: (name: string, value: string, options?: CookieOptions) => void;
}
// Dans createServerClient, la signature setAll :
setAll(
  cookiesToSet: Array<{
    name: string;
    value: string;
    options?: CookieOptions;
  }>,
)
```

Ceci retire le `as Record<string, unknown>` dans `apps/website/src/lib/supabase/server.ts` et aligne l'interface sur les types officiels `@supabase/ssr`.

### 2. Retirer `tsyringe` des dépendances du bot

**Fichier :** `/home/ubuntu/rg/apps/bot/package.json`

Supprimer la ligne `"tsyringe": "catalog:"` des `dependencies`. Dead dep confirmé — aucun usage dans `src/`. Réduit la surface d'installation.

### 3. Centraliser les env vars du bot dans `lib/config.ts`

**Fichier à créer :** `/home/ubuntu/rg/apps/bot/src/lib/config.ts`

```ts
// Fail-fast à l'initialisation du processus
export const GUILD_ID = Bun.env.GUILD_ID; // optional — bot peut tourner sans guild

export function requireEnv(key: string): string {
	const v = Bun.env[key];
	if (!v) throw new Error(`[config] ${key} is required`);
	return v;
}
```

Remplacer les 3 `const GUILD_ID = Bun.env.GUILD_ID` dans `index.ts`, `ready.ts`, `memberEvents.ts` par un import unique. Évite la dérive silencieuse si la variable change de nom.

### 4. Simplifier le double cast Redis dans `lib/cache.ts`

**Fichier :** `/home/ubuntu/rg/apps/bot/src/lib/cache.ts`, ligne 59

```ts
// Avant
return JSON.parse(raw as unknown as string) as T;

// Après (Bun types confirment que get() retourne Promise<string | null>)
return JSON.parse(raw) as T;
```

### 5. Activer `noUncheckedIndexedAccess` dans `tsconfig-base.json`

**Fichier :** `/home/ubuntu/rg/packages/config/tsconfig-base.json`

```json
{
	"compilerOptions": {
		"noUncheckedIndexedAccess": true
	}
}
```

Ceci remontera des `T | undefined` sur tous les accès par index. Les `rows[0]!` et `members[i]!` dans les services devront être convertis en guards explicites ou en assertions documentées. Coût : quelques dizaines de corrections. Bénéfice : détection compile-time des SQL queries qui peuvent retourner zéro lignes.

---

_Audit LECTURE SEULE — aucun fichier modifié. Périmètre : `packages/db/src/` + `apps/bot/src/`. Hors périmètre : `packages/ui/`, `apps/azalee/`, `apps/website/`._
