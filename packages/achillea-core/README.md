# @achillea/core

Logique métier **portable** d'Achilléa : un seul code source qui tourne en **navigateur**, en **edge (Deno / Web)**, en **Node** et en **Bun**.

Aucune dépendance Discord (`discord.js` / `@aphrody/discordx`), ORM (`@mikro-orm/*`), DI (`tsyringe`) ni API Node-only. Uniquement des standards Web (`crypto.subtle`, `crypto.getRandomValues`, `Intl`, `URL`, `TextEncoder`) + `@achillea/types`, `@casl/ability`, `@sindresorhus/transliterate`.

## Domaines

| Import                      | Contenu                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@achillea/core/elo`        | `computeMatchElo`, `expectedScore`, `eloDelta`, `applyEloUpdate`                                             |
| `@achillea/core/ranking`    | `eloToTier`, `eloToRankKey`, `computePercentile`                                                             |
| `@achillea/core/sanctions`  | `evaluateEscalation` (3/5/8 → mute/ban)                                                                      |
| `@achillea/core/licenses`   | `formatLicenseNumber`, `parseLicenseNumber`, `generateQrSecret`, `evaluateLicenseValidity`, `signHmacSha256` |
| `@achillea/core/votes`      | `evaluateProposalOutcome` (MAJORITY / SUPERMAJORITY_2_3 / UNANIMOUS)                                         |
| `@achillea/core/names`      | `normalizeNames`                                                                                             |
| `@achillea/core/format`     | `formatDate`, `formatNumber`, `formatAchCurrency`                                                            |
| `@achillea/core/access`     | `buildAbilityFor` (CASL RBAC)                                                                                |
| `@achillea/core/validation` | `validString`, `isValidUrl`, `numberAlign`, `chunkArray`                                                     |
| `@achillea/core/enums`      | `SanctionType`, `VotingStrategy`, `LicenseStatus`, `AchilleaRole`, …                                         |

> Tout est aussi exporté depuis la racine `@achillea/core`. Le bot (TS `moduleResolution: Node`) importe **uniquement** depuis le specifier bare `@achillea/core` ; les sous-chemins (`/elo`, …) sont destinés aux consommateurs en résolution `bundler`/`Node16`/Deno.

## Exemples de consommation par cible

### 1. Angular (navigateur) — service injectable + supabase-js

```ts
import { Injectable, signal } from "@angular/core";
import { computeMatchElo, eloToRankKey, type RankTier } from "@achillea/core";
import { createClient } from "@supabase/supabase-js";

@Injectable({ providedIn: "root" })
export class RankingService {
	private supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
	readonly tiers = signal<RankTier[]>([]);

	async preview(myElo: number, oppElo: number) {
		const { newWinner } = computeMatchElo(myElo, oppElo);
		return eloToRankKey(newWinner, this.tiers()); // "Gold", "Diamond", …
	}
}
```

### 2. Fonction serverless / Edge (Node)

```ts
// api/escalate.ts
import { evaluateEscalation } from "@achillea/core";

export async function POST(req: Request) {
	const { activeWarns } = await req.json();
	const decision = evaluateEscalation(activeWarns); // null | { type, durationSec }
	return Response.json({ decision });
}
```

### 3. Supabase Edge Function (Deno / Web)

```ts
// supabase/functions/verify-license/index.ts
import { evaluateLicenseValidity, isValidLicenseNumber } from "npm:@achillea/core/licenses";

Deno.serve(async (req) => {
	const { licenseNumber, status, validUntil } = await req.json();
	if (!isValidLicenseNumber(licenseNumber)) {
		return new Response("format invalide", { status: 400 });
	}
	const result = evaluateLicenseValidity({ status, validUntil });
	return Response.json(result); // { valid, reason? }
});
```

### 4. Script Bun

```ts
// scripts/recompute-ranks.ts
import { computeMatchElo, DEFAULT_K_FACTOR } from "@achillea/core/elo";

const { newWinner, newLoser, delta } = computeMatchElo(1000, 1000, DEFAULT_K_FACTOR);
console.info({ newWinner, newLoser, delta }); // { 1016, 984, 16 }
```

### 5. Webhook handler (signature HMAC, Web Crypto — Node / edge / Bun)

```ts
import { signHmacSha256, verifyHmacSha256 } from "@achillea/core/licenses";

// Émission d'un QR auto-vérifiable
const payload = JSON.stringify({ licenseNumber: "ACH-2026-00042" });
const signature = await signHmacSha256(payload, secret);

// Réception
const ok = await verifyHmacSha256(payload, incomingSignature, secret);
if (!ok) throw new Error("signature invalide");
```

## Développement

```bash
bun run --filter @achillea/core type-check
bun run --filter @achillea/core test   # bun test (tests/core.test.ts + tests/domains.test.ts)
bun run --filter @achillea/core lint
bunx oxfmt packages/achillea-core
```

> Consommé **en source** (`main`/`types`/`exports` pointent sur `./src/*.ts`) : pas de build séparé, les consommateurs (web, bot, edge) importent directement le TypeScript.
