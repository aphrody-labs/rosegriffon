---
name: steam-auth
description: This skill should be used when the user asks to "add Sign in through Steam", "verify a Steam OpenID response", "validate a Steam session ticket", "use AuthenticateUserTicket", "how do Steam refresh tokens work", "Steam Guard codes", "get a Web API or publisher key", or "log in to Steam without OAuth". For calling Web API methods, steam-web-api applies.
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
- Always verify OpenID responses server-side; the required checks are in
  [`references/openid.md`](references/openid.md).
- Publisher key host and server-only handling: [`references/keys.md`](references/keys.md).
- Treat tokens, Steam Guard secrets and keys as secrets. Never print them, log them or commit
  them; refer to them by name. The local credential files the plugin refuses to read are listed
  in [`../steam-local-inspect/SKILL.md`](../steam-local-inspect/SKILL.md) (Rules).
- Steam OAuth is partner-only; the status and the supported paths without a partner account
  are in [`references/non-partner.md`](references/non-partner.md).

## Procedures

### Web login (OpenID 2.0)

With the plugin MCP server, steps 1 and 2 are the tools `openid_login_url` and
`openid_verify`.

1. Redirect to the Steam OpenID endpoint with `checkid_setup`.
2. On the callback, verify with `check_authentication` before trusting the assertion.
3. Extract the SteamID64 from `openid.claimed_id`, then fetch profile data with
   `ISteamUser/GetPlayerSummaries/v2` (key required; use the `web_api_call` MCP tool).

Full parameter list, response example and pitfalls: [`references/openid.md`](references/openid.md).

### Game-to-backend identity (tickets)

1. In the game, call `ISteamUser::GetAuthTicketForWebApi("<identity>")` and wait for
   `GetTicketForWebApiResponse_t`; hex-encode the ticket.
2. The backend calls `ISteamUserAuth/AuthenticateUserTicket/v1` (parameters in
   [`references/tickets.md`](references/tickets.md)). Use the returned `steamid` and `ownersteamid`
   (family sharing) and check the ban flags.
3. For peer-to-peer or game-server checks, use `GetAuthSessionTicket` with
   `BeginAuthSession` on the receiving side instead.

Details: [`references/tickets.md`](references/tickets.md).

### Account login (IAuthenticationService)

Account login uses the `Authentication` service (credentials or QR, Steam Guard, refresh and
access tokens); the RPC sequence and what `crates/steam-depot` implements:
[`references/sessions.md`](references/sessions.md).

## Additional Resources

- `references/openid.md`: OpenID 2.0 flow, every parameter, verification, pitfalls.
- `references/tickets.md`: session tickets, AuthenticateUserTicket, BeginAuthSession.
- `references/sessions.md`: IAuthenticationService RPCs, enums, tokens, Steam Guard,
  what bun-steam implements.
- `references/keys.md`: Web API keys, publisher keys.
- `references/non-partner.md`: supported login paths without a partner account, with the
  plugin tools for each.
- Related skills: steam-web-api (methods and hosts), steam-ids-and-urls (SteamID forms).

## Sources

- https://partner.steamgames.com/doc/features/auth
- https://partner.steamgames.com/doc/webapi_overview/auth
- https://partner.steamgames.com/doc/webapi_overview/oauth
- https://partner.steamgames.com/doc/webapi/ISteamUserAuth
- https://partner.steamgames.com/doc/api/ISteamUser
- https://openid.net/specs/openid-authentication-2_0.html
- `third_party/steam-protobufs/steam/steammessages_auth.steamclient.proto`
- `third_party/node-steam-session` (README and src)
- `crates/steam-depot/src/depot/auth.rs`, `crates/steam-depot/src/depot/token_store.rs`
