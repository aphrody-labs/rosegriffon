---
name: steam-auth
description: This skill should be used when the user asks to "add Sign in through Steam", "implement Steam OpenID login", "verify a Steam OpenID response", "validate a Steam session ticket", "use AuthenticateUserTicket", "GetAuthTicketForWebApi", "how do Steam refresh tokens work", "IAuthenticationService login flow", "Steam Guard codes", "get a Steam Web API key or publisher key", or "does Steam support OAuth". It covers every Steam authentication mechanism and which one fits each use case.
---

# Steam authentication

Steam has several unrelated authentication mechanisms. Pick by who is proving what to whom:

| Need                                                          | Mechanism                                                                                                       | Reference                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| A website learns the visitor's SteamID                        | OpenID 2.0 ("Sign in through Steam")                                                                            | `references/openid.md`   |
| A game server or backend verifies the player running the game | Session tickets: `GetAuthTicketForWebApi` / `GetAuthSessionTicket` plus `ISteamUserAuth/AuthenticateUserTicket` | `references/tickets.md`  |
| A tool logs into a Steam account (CM or web session)          | `IAuthenticationService` (access and refresh tokens, Steam Guard)                                               | `references/sessions.md` |
| A backend calls the Web API                                   | Web API key (user) or publisher key (partner)                                                                   | `references/keys.md`     |

## Core rules

- Never accept a SteamID that the client sends in plain form. Derive it from a verified
  OpenID assertion or a verified ticket only.
- Always verify OpenID responses server-side with `openid.mode=check_authentication`
  against `https://steamcommunity.com/openid/login`, and check that `openid.claimed_id`
  matches `https://steamcommunity.com/openid/id/<steamid64>` and that `openid.return_to`
  is the server's own URL (source: https://partner.steamgames.com/doc/features/auth and
  https://openid.net/specs/openid-authentication-2_0.html section 11).
- Publisher keys are secret and server-side only; they go to `partner.steam-api.com`, not
  to clients (source: https://partner.steamgames.com/doc/webapi_overview/auth).
- Treat refresh tokens, access tokens, `shared_secret`, `identity_secret`, Web API keys and
  `ssfn`/`config.vdf` contents as secrets. Never print them, log them or commit them; refer
  to them by name.
- Steam offers OAuth only to selected partners on request; there is no general public
  OAuth client registration. Use OpenID for web login (source:
  https://partner.steamgames.com/doc/webapi_overview/oauth, fetched 2026-11-12).

## Procedures

### Web login (OpenID 2.0)

1. Redirect to `https://steamcommunity.com/openid/login` with
   `openid.ns=http://specs.openid.net/auth/2.0`, `openid.mode=checkid_setup`,
   `openid.return_to=<callback>`, `openid.realm=<origin>`,
   `openid.identity` and `openid.claimed_id` both set to
   `http://specs.openid.net/auth/2.0/identifier_select`.
2. On the callback, copy every `openid.*` parameter, set `openid.mode=check_authentication`
   and POST them back to the same endpoint. Accept only if the body contains
   `is_valid:true`.
3. Extract the SteamID64 from `openid.claimed_id`, then fetch profile data with
   `ISteamUser/GetPlayerSummaries/v2` (key required; use the `web_api_call` MCP tool).

Full parameter list, response example and pitfalls: `references/openid.md`.

### Game-to-backend identity (tickets)

1. In the game, call `ISteamUser::GetAuthTicketForWebApi("<identity>")` and wait for
   `GetTicketForWebApiResponse_t`; hex-encode the ticket.
2. The backend calls `ISteamUserAuth/AuthenticateUserTicket/v1` with `key`, `appid`,
   `ticket` and the same `identity`. Use the returned `steamid` and `ownersteamid`
   (family sharing) and check the ban flags.
3. For peer-to-peer or game-server checks, use `GetAuthSessionTicket` with
   `BeginAuthSession` on the receiving side instead.

Details: `references/tickets.md`.

### Account login (IAuthenticationService)

The Steam client, the mobile app and libraries such as node-steam-session use the
`Authentication` service from `steammessages_auth.steamclient.proto`:
`GetPasswordRSAPublicKey`, `BeginAuthSessionViaCredentials` or `BeginAuthSessionViaQR`,
then `UpdateAuthSessionWithSteamGuardCode` or a mobile confirmation, then
`PollAuthSessionStatus`, which returns a refresh token and an access token (JWTs). Access
tokens are renewed with `GenerateAccessTokenForApp`. `apps/rosegriffon/crates/bun-steam`
implements only that renewal step from a stored refresh token. Details:
`references/sessions.md`.

## Additional Resources

- `references/openid.md`: OpenID 2.0 flow, every parameter, verification, pitfalls.
- `references/tickets.md`: session tickets, AuthenticateUserTicket, BeginAuthSession.
- `references/sessions.md`: IAuthenticationService RPCs, enums, tokens, Steam Guard,
  what bun-steam implements.
- `references/keys.md`: Web API keys, publisher keys, OAuth status.
- Related skills: steam-web-api (methods and hosts), steam-ids-and-urls (SteamID forms).

## Sources

- https://partner.steamgames.com/doc/features/auth
- https://partner.steamgames.com/doc/webapi_overview/auth
- https://partner.steamgames.com/doc/webapi/ISteamUserAuth
- https://partner.steamgames.com/doc/api/ISteamUser
- https://openid.net/specs/openid-authentication-2_0.html
- third_party/steam-ecosystem/steam-protobufs/steam/steammessages_auth.steamclient.proto
- third_party/steam-ecosystem/node-steam-session (README and src)
- apps/rosegriffon/crates/bun-steam/src/depot/auth.rs, token_store.rs
