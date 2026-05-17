
> ⚠️ **INFRASTRUCTURE GÉRÉE PAR ANTIGRAVITY (GOD MODE)**
> Ce projet opère sous la **Directive Omega**. L'architecture, les dépendances, et le code sont gérés et refactorisés de manière 100% autonome. Aucune sécurité conservative n'est appliquée. La performance brute est l'unique métrique.
\n# @rose-griffon/patreon-bun

[![npm](https://img.shields.io/npm/v/@rose-griffon/patreon-bun)](https://www.npmjs.com/package/@rose-griffon/patreon-bun)
[![Bun](https://img.shields.io/badge/runtime-bun-fbf0df)](https://bun.sh)

**Bun-only TypeScript library for the V2 Patreon API.** Fork of [`patreon-api.ts`](https://github.com/ghostrider-05/patreon-api.ts) by [ghostrider-05](https://github.com/ghostrider-05), maintained by [Rose Griffon](https://rosegriffon.fr) for the migration from Patreon to a Stripe-based supporter platform.

> **Bun ≥ 1.1**, ESM-only. For Node.js compatibility use the upstream package `patreon-api.ts`.

## Why this fork

The upstream `patreon-api.ts` ships dual CJS+ESM via `tsup` and targets Node 22+. This fork drops:

- `tsup` → `bun build` (native, ~13 ms)
- `vitest` → `bun:test` (P3 — coming in 0.21)
- `eslint` → `oxlint`
- `npm` lockfiles → `bun.lock`
- CommonJS exports → ESM-only

The runtime code itself is unchanged; only the toolchain is Bun-native.

## Install

```sh
bun add @rose-griffon/patreon-bun
```

## Usage

```ts
import {
  PatreonOauthClient,
  PatreonCreatorClient,
  parseWebhookRequest,
  Type,
} from '@rose-griffon/patreon-bun'

const client = new PatreonCreatorClient({
  oauth: {
    clientId: Bun.env.PATREON_CLIENT_ID!,
    clientSecret: Bun.env.PATREON_CLIENT_SECRET!,
    accessToken: Bun.env.PATREON_CREATOR_ACCESS_TOKEN!,
    refreshToken: Bun.env.PATREON_CREATOR_REFRESH_TOKEN!,
  },
})

const campaigns = await client.fetchCampaigns()
console.log(campaigns)
```

## Webhook server with `Bun.serve`

```ts
import { parseWebhookRequest } from '@rose-griffon/patreon-bun'

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/webhook' && req.method === 'POST') {
      const result = await parseWebhookRequest(req, Bun.env.PATREON_WEBHOOK_SECRET!)
      if (!result.verified) return new Response('Unauthorized', { status: 401 })
      console.log(result.event, result.payload)
      return new Response('OK')
    }
    return new Response('Not Found', { status: 404 })
  },
})
```

## Roadmap

- **0.20.x** — ESM-only Bun rebrand, JS bundle (current)
- **0.21.0** — TypeScript declarations (`.d.ts`) shipped
- **0.22.0** — `vitest` → `bun:test` migration with MSW compat layer
- **0.23.0** — Full upstream sync from `patreon-api.ts` 0.20+

## License

MIT — same as upstream. Original copyright [ghostrider-05](https://github.com/ghostrider-05).

## Documentation

For full API documentation see the upstream docs: https://patreon-api.pages.dev/

## Credits

This fork stands on the shoulders of `patreon-api.ts` v0.19.0. All API logic, OAuth flows, and webhook handling are credited to the original author. Rose Griffon only adapted the toolchain to Bun.
