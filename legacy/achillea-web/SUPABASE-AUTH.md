# Authentification Supabase (OAuth Discord) — web

Le front sait se connecter de **deux** façons. La seconde est codée mais **dormante** tant
que le provider Discord n'est pas activé côté Supabase.

## 1. Cookie/JWT du bot (actif, par défaut)

Flux historique, opérationnel en prod :

- `GET /api/auth/discord?state=…` → 302 vers Discord OAuth (scope `identify`, app prod
  `1427690638576582697` = AchilleaBot ; proxy nginx → bot VPS),
- callback `GET /api/auth/callback` → échange du code + `syncWebUser`, puis le bot pose un cookie
  `token=<JWT>; HttpOnly; Secure; SameSite=Lax` (JWT **HS256** signé avec `JWT_SECRET_KEY`, 30 j),
- `GET /api/auth/me` / `/api/users/me` lisent ce cookie (middleware `CookieAuthorize`, vérif HS256).

C'est le **fallback** utilisé tant que l'auth Supabase n'est pas activée. Rien à faire.

## 2. Supabase Auth (OAuth Discord) — optionnel, à activer

Côté code (déjà prêt) :

- `SupabaseService` (`src/app/core/supabase/supabase.service.ts`) crée le client avec
  `flowType: "pkce"`, `persistSession`, `autoRefreshToken`, `detectSessionInUrl`,
- `loginWithSupabase(returnUrl)` (`src/app/shared/services/user-service.ts`) appelle
  `auth.signInWithOAuth({ provider: "discord", … })`,
- la session (`supabaseSession`) est hydratée au démarrage (`auth.getSession()`) et suivie
  (`onAuthStateChange`) ; `logOut()` fait un `auth.signOut()` best-effort.

Pour l'**activer** (console Supabase, projet `yftdclwvehxxffwqvhmc`) :

1. **Authentication → Providers → Discord** : activer, renseigner `Client ID` / `Client Secret`
   de l'app Discord prod `1427690638576582697` (AchilleaBot).
2. **Redirect URLs** : ajouter `https://achillea.rosegriffon.fr/**` (et l'URL de dev locale).
3. Dans le **Discord Developer Portal → OAuth2 → Redirects**, ajouter l'URL de callback Supabase
   `https://yftdclwvehxxffwqvhmc.supabase.co/auth/v1/callback` (au caractère près).
4. NB : l'auth ici est **uniquement** l'OAuth Discord — pas d'email/mot de passe. Le réglage
   _Leaked password protection_ ne s'applique donc qu'au cas (non prévu) où un provider
   email/password serait ajouté.

Tant que ces étapes ne sont pas faites, `signInWithOAuth` échoue côté Supabase et l'app
retombe sur le flux cookie/JWT du bot (point 1). Aucune régression : le code Supabase reste
inerte sans configuration dashboard.

## Périmètre des données

- **Lecture dashboard** (clas­sements, clans, casters…) : Supabase **direct** via la clé
  publishable (vues curatées `*_view`, RLS).
- **Écritures métier** (elo, wallet, sanctions, ranked live) : **API du bot** (proxy nginx).
