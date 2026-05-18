# @rg/db

Package database partagé pour l'écosystème Rose Griffon.

## Contenu

- **Types Supabase :** Source de vérité générée via `bun run types:gen`.
- **Clients Clients/Serveur :** Helpers pour instancier le client Supabase selon l'environnement (Next.js SSR, Browser, Service Role).
- **Storage :** Utilitaires pour la gestion des assets sur Supabase Storage.
- **Services :** Logique métier transverse (ex: agrégation de statistiques dashboard).

## Utilisation

```typescript
import { createSupabaseServiceClient } from "@rg/db/service";

const supabase = createSupabaseServiceClient();
const { data } = await supabase.from("profiles").select("*");
```

## Scripts

- `types:gen` : Régénère les types TypeScript depuis l'instance Supabase distante.
- `type-check` : Vérifie la validité des types du package.
- `test` : Lance les tests unitaires via Vitest.
