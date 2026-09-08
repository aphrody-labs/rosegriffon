# Authentification Achillea

L’authentification utilisateur est centralisée dans l’API Achillea. Le client Supabase du
frontend sert uniquement aux lectures publiques protégées par RLS et ne crée pas de seconde
session navigateur.

## Flux canonique Discord

1. Le frontend appelle `GET /api/auth/discord?state=…`.
2. L’API signe le `state`, le lie à un nonce dans un cookie HttpOnly de 10 minutes, puis redirige
   vers Discord OAuth2 (`identify`).
3. `GET /api/auth/callback` vérifie la signature, le nonce et la destination interne, échange le
   code, synchronise l’utilisateur et pose le cookie `token`.
4. `GET /api/users/me` hydrate l’unique état d’auth Angular (`AuthSessionService`).
5. `POST /api/auth/logout` efface le cookie avec exactement le même scope.

Le cookie de session est `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS, valable 30 jours. Les
nouveaux JWT sont limités par `issuer`, `audience`, `subject` et `tokenUse=session`. Les anciens
JWT sans ces claims restent temporairement lisibles pendant leur expiration naturelle afin de
permettre une migration sans déconnexion générale.

## Temps réel

Le cookie du domaine web ne traverse pas vers le domaine WebSocket. Le frontend demande donc
`GET /api/auth/token`, qui émet un JWT distinct `tokenUse=realtime`, limité à 5 minutes. Un cache
unique dans `AuthSessionService` alimente Socket.IO et Colyseus. Le JWT de session de 30 jours
n’est jamais exposé au JavaScript.

## Supabase

`SupabaseService` utilise la clé publishable pour les vues publiques. Sa configuration désactive
`persistSession`, `autoRefreshToken` et `detectSessionInUrl` afin d’éviter un second flux OAuth
concurrent avec le cookie de l’API. Les écritures métier et toutes les autorisations restent
arbitrées côté serveur.
