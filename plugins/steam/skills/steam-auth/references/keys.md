# Web API keys, publisher keys, OAuth

## User Web API key

- Obtained at https://steamcommunity.com/dev/apikey by an account that meets Valve's
  conditions (a non-limited account; source: https://steamcommunity.com/dev).
- One key per account, bound to a domain name declared at creation.
- Usage is governed by https://steamcommunity.com/dev/apiterms (100,000 calls per day).
- Sent as the `key` query parameter or the `x-webapi-key` header
  (https://partner.steamgames.com/doc/webapi_overview/auth).
- In this plugin, set `STEAM_WEB_API_KEY` in the environment; the MCP server reads it and
  redacts it from any URL it echoes.

## Publisher Web API key

- Created by a Steamworks partner in the partner site (Users and Permissions, Manage
  Groups, Web API key on a group).
- Required for partner-only methods (ownership checks, microtransactions, leaderboard
  writes, `CheckAppOwnership`), which must be called on `https://partner.steam-api.com`.
- Server-side only. Never embed it in a game client or a web page.
- Source: https://partner.steamgames.com/doc/webapi_overview/auth

## OAuth

Steam OAuth is available only to partners approved by Valve, on request (a client id is
issued by Valve). There is no self-service OAuth client registration. For website login use
OpenID 2.0 (`openid.md`). Source: https://partner.steamgames.com/doc/webapi_overview/oauth
(fetched 2026-11-12).
