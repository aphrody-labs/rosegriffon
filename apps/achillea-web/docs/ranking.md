# Ranked Achillea — Spec et plan d'intégration

Site `achillea-web` (Angular 21) + backend `achillea-bot` (Bun + TSed + Mikro-ORM + Discord). Temps réel via Colyseus 0.17.

## 1. Objectifs (cahier des charges)

Liste des features à livrer (points = priorité indicative donnée par le PO) :

| #   | Feature                                                        | Pts | Surface          |
| --- | -------------------------------------------------------------- | --- | ---------------- |
| 1   | Bouton "classé" dans la navbar                                 | 1   | front            |
| 2   | Page résumé du rang actuel (logo + AP)                         | 2   | front + REST     |
| 3   | Bouton rechercher adversaire                                   | 1   | front + Colyseus |
| 4   | Affichage de l'adversaire                                      | 1   | front + Colyseus |
| 5   | Code de room généré et donné aux joueurs                       | 2   | Colyseus         |
| 6   | Chat de room sur le site                                       | 3   | front + Colyseus |
| 7   | Bouton "match fini"                                            | 2   | front + Colyseus |
| 8   | Les 2 joueurs doivent enregistrer le score                     | 1   | Colyseus + DB    |
| 9   | Alerte popup contestation si scores divergent (screen demandé) | 2   | front + Colyseus |
| 10  | Admins valident le résultat d'un match contesté                | 2   | REST + DB        |
| 11  | Affichage du gain de la ranked                                 | 2   | front + DB       |
| 12  | Retour à la page matchmaking                                   | 1   | front            |

Total : 20 points.

## 2. État de l'existant côté bot

`achillea-bot/src/entities/` couvre déjà l'essentiel du modèle :

| Entity                     | Rôle                                | Champs utiles                                                                    |
| -------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| `UserElo`                  | rang/AP par user et par mode/season | `elo`, `peakRating`, `gamesPlayed`, `wins`, `losses`                             |
| `Rank`                     | paliers (Bronze/Argent/Or…)         | `key`, `minElo`, `maxElo`, `emojiId`, `gradient[]`                               |
| `Season`                   | saisons + config Elo                | `kFactor`, `baseRating`, `decayRate`                                             |
| `Lobby`                    | container d'un match                | `state`, `mode`, `matchFormat`, `lobbyUsers`, `lobbyMatches`                     |
| `LobbyMatch`               | un game (BO1/BO3)                   | `scoreTeam1`, `scoreTeam2`, `team1Validated`, `team2Validated`, `adminValidated` |
| `LobbyUser`                | inscription d'un user au lobby      | `team`, `score`, `forfeit`, `eloVariation`, `validatedResult`, `state`           |
| `Ranked` (extends `Event`) | event ranked tournoi                | `status`, `queueEndsAt`, `mode`                                                  |
| `RankedQueueEntry`         | inscription file ranked             | `user`, `ranked`, `validatedPresence`                                            |

**Mécanique de validation déjà modélisée** :

```ts
// LobbyMatch.ts
get isValidated(): boolean {
  return this.adminValidated || (this.team1Validated && this.team2Validated)
}
```

C'est exactement le flow demandé : si `team1Validated && team2Validated` → ok ; sinon contestation → admin force `adminValidated`.

## 3. Stack temps réel

### Existant

- `socket-server.ts` : Socket.IO sur `SOCKET_PORT` (4001 prod), Express+http.Server bare
- Namespace `/notifications` avec auth cookie JWT (cookie `token`, secret `env.JWT_SECRET_KEY`)
- Helper `emitToUsers(userIds, event, payload)`
- CORS allowlist : `localhost:4200`, `achillea.rosegriffon.fr`

### Ajout

- **Colyseus 0.17** sur port dédié (`:4002`) — process séparé `achillea-ranked.service`
- Transport : `BunWebSockets` (natif Bun, couche compat Express incluse)
- Schema state via `@colyseus/schema 4.0`
- Auth via `onAuth(token)` qui verify le cookie session (alignement front ↔ bot, voir §6)

## 4. Architecture cible

```
Angular CSR (nginx VPS)
   ├── HTTP REST  ──►  nginx VPS (proxy /api/*)            /api/auth/*
   ├── HTTP REST  ──►  achillea-bot TSed                   :4000  /api/ranked/me, /api/admin/lobbies/:id/validate
   ├── Socket.IO  ──►  achillea-bot socket-server          :4001  /notifications
   └── WSS        ──►  achillea-ranked Colyseus            :4002  rooms QueueRoom + MatchRoom
                                │
                                └─► Postgres local (Mikro-ORM EM partagé)
```

## 5. Plan d'implémentation côté bot

```
apps/achillea-bot/
├── src/
│   ├── main.ts                       (inchangé, CJS)
│   ├── api/                          (inchangé, REST TSed sur :4000)
│   ├── websockets/socket-server.ts   (inchangé, /notifications sur :4001)
│   └── ranked/                       ── NEW (ESM Bun direct, pas tsc)
│       ├── main.ts                   Bun.serve + BunWebSockets transport
│       ├── rooms/
│       │   ├── QueueRoom.ts          matchmaking (filterBy elo±200)
│       │   └── MatchRoom.ts          state (p1, p2, scores, chat[], status)
│       ├── auth.ts                   verify JWT cookie session
│       └── orm.ts                    init Mikro-ORM standalone (pas de Discord)
├── infra/systemd/
│   └── achillea-ranked.service       NEW
└── infra/nginx/
    └── ranked.achillea.conf          NEW (wss://ranked.rosegriffon.fr → :4002)
```

### Endpoints REST ajoutés (côté TSed existant)

- `GET /api/ranked/me` — UserElo + Rank tier courant (auth cookie)
- `GET /api/ranked/leaderboard` — top N par mode
- `POST /api/admin/lobbies/:id/validate` — admin force `adminValidated=true` + recalcule Elo (auth role Administrator)
- `POST /api/admin/lobbies/:id/dispute/:userId/screenshot` — upload screenshot contestation

### Schema state Colyseus (`MatchRoom`)

```ts
class ChatMessage extends Schema {
	@type("string") userId: string;
	@type("string") text: string;
	@type("number") at: number;
}

class PlayerState extends Schema {
	@type("string") userId: string;
	@type("string") displayName: string;
	@type("string") avatar: string;
	@type("number") elo: number;
	@type("number") submittedScore: number = -1;
	@type("boolean") confirmedFinish: boolean = false;
}

class MatchState extends Schema {
	@type("string") roomCode: string; // 6-char user-friendly
	@type("string") status: string; // waiting | playing | scoring | disputed | finished
	@type({ map: PlayerState }) players = new MapSchema<PlayerState>();
	@type([ChatMessage]) chat = new ArraySchema<ChatMessage>();
	@type("string") disputeReason: string = "";
}
```

### Flow ranked

```
1. Client → joinOrCreate("queue", { mode, elo })
   → Colyseus QueueRoom matche par filterBy elo±200, sortBy clients:-1
   → quand 2 joueurs présents : QueueRoom crée un MatchRoom et delivre roomCode
2. Les 2 clients passent sur MatchRoom (consume reservation)
   → state synchronise les 2 joueurs + roomCode
3. UI : chat + bouton "match fini" → room.send("submitScore", { score })
4. Quand les 2 ont submitScore :
   - identique → status=finished, persist Lobby + LobbyMatch + UserElo, émet eloVariation
   - divergent → status=disputed, popup screenshot
5. Si disputed : admin via REST POST /admin/lobbies/:id/validate
   → set adminValidated=true, recalcule Elo, broadcast au MatchRoom (si toujours actif)
6. UI affiche eloVariation et bouton "retour matchmaking"
```

## 6. Mismatchs à régler

| Mismatch   | Côté front   | Côté bot                               | Décision                              |
| ---------- | ------------ | -------------------------------------- | ------------------------------------- |
| Nom cookie | `session`    | `token`                                | aligner sur `token` (le bot dicte)    |
| Var JWT    | `JWT_SECRET` | `JWT_SECRET_KEY`                       | mettre la même valeur dans les 2 vars |
| CORS bot   | n/a          | n'inclut pas `achillea.rosegriffon.fr` | ajouter                               |

## 7. Système Elo

Formule classique avec K-factor par `Season.config.kFactor` (entity existante) :

```ts
const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
const delta = Math.round(kFactor * (actual - expected)); // actual = 1 (win) ou 0 (loss)
newElo = playerElo + delta; // borné à [0, ∞[
```

`UserElo.peakRating = max(peakRating, newElo)`.

Tier courant = ligne `Rank` où `minElo <= newElo <= maxElo`.

## 8. Questions ouvertes (à valider avant code)

1. **Aligner cookie+secret JWT** front ↔ bot ? Ou endpoint d'échange `/api/auth/exchange` ?
2. **Ranked perpétuel** : 1 entity `Ranked` permanente OPEN, ou matchmaking 100% en mémoire (Colyseus QueueRoom RAM-only) avec création directe `Lobby` à la fin ?
3. **Sous-domaine** : `ranked.rosegriffon.fr` (vhost dédié) ou path `api.rosegriffon.fr/ranked/` ?
4. **Process** : `achillea-ranked.service` séparé (recommandé), ou greffé dans `main.ts` du bot ?
5. **Système Elo** : K-factor unique par season, ou par tier (provisional placement vs ranked confirmé) ?
6. **BO1 ou BO3 par défaut** ? (`Lobby.matchFormat` supporte déjà `SINGLE_LEG`, `DOUBLE_LEG`, `CUSTOM`)
7. **Anti-grief** : timeout auto si un joueur ne valide pas son score sous N minutes ? Forfeit auto ?

## 9. Refs

- Colyseus docs : https://docs.colyseus.io/
- Bot — entities ranked : `apps/achillea-bot/src/entities/{UserElo,Rank,Season,Lobby,LobbyMatch,LobbyUser,Ranked,RankedQueueEntry}.ts`
- Bot — socket existant : `apps/achillea-bot/src/websockets/socket-server.ts`
- Bot — TSed bootstrap : `apps/achillea-bot/src/api/server.ts`
- Stack canvas alignée : `@aphrody-code/canvas@0.1.99-fork.4` (cf `README.md`)
