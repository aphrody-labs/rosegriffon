# @rosegriffon/auth

Logique d'authentification et gardes de sécurité partagés.

## Contenu

- **Bridge Profil :** Réconciliation entre les IDs d'utilisateurs `Better Auth` et les profils `Supabase`.
- **RBAC :** Helpers pour vérifier les rôles (`isAdmin`, `isStaff`).
- **Garde Serveur :** `createAdminGuard` pour sécuriser les routes et Server Actions.

## Utilisation

```typescript
import { resolveProfile } from "@rosegriffon/auth";

// Dans un Server Action
const user = await requireAuth();
const profile = await resolveProfile(supabase, user);
```

## Architecture

- Le package dépend de `better-auth` pour la gestion des sessions.
- Il utilise `@rosegriffon/db` pour la lecture des profils et des comptes liés (Discord, etc.).
- La configuration Better Auth du site est centralisée dans `createRoseGriffonAuth`.
  `apps/website/src/lib/auth.ts` ne fournit que le pool PostgreSQL, l'envoi de
  courriels, les cookies Next.js et l'adaptateur Patreon.
- L'instance Elysia de l'API reste séparée dans `@rosegriffon/auth/elysia` :
  elle expose MCP et les capacités Agent Auth, tandis que le site expose le
  provider OAuth navigateur. Les deux partagent `commonAuthOptions` et le
  même modèle de rôles métier.
