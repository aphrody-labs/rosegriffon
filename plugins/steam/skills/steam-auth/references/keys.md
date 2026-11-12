# Web API keys, publisher keys, OAuth

## User Web API key

- Obtained at https://steamcommunity.com/dev/apikey; it needs "a Steam account and the
  domain name that will be associated with this key" and acceptance of the Web API Terms
  (https://partner.steamgames.com/doc/webapi_overview/auth, fetched 2026-11-12).
- The terms limit usage to 100,000 calls per day, and the key is "personal to you and
  specific to your Application" and must stay confidential
  (https://steamcommunity.com/dev/apiterms, fetched 2026-11-12).
- Sent as the `key` parameter or the `x-webapi-key` request header (same partner page).
  The plugin MCP server always uses the header, so the key never appears in a URL
  (`web_api_call` sets `x-webapi-key` in `plugins/steam/servers/steam-mcp.ts`).
- In this plugin, set `STEAM_WEB_API_KEY` in the environment (see `plugins/steam/README.md`).

## Publisher Web API key

- Created by a Steamworks administrator: Users & Permissions, Manage Groups, select or
  create a group, Create WebAPI Key
  (https://partner.steamgames.com/doc/webapi_overview/auth, fetched 2026-11-12).
- It is used on `https://partner.steam-api.com`. Some methods accept either key: for
  `ISteamUserAuth/AuthenticateUserTicket` the partner host takes the publisher key and
  `api.steampowered.com` takes a user key, rate limited
  (https://partner.steamgames.com/doc/webapi/ISteamUserAuth, fetched 2026-11-12).
- Keep it on servers only; that page says `AuthenticateUserTicket` "can never be used
  directly by clients".
- Source: https://partner.steamgames.com/doc/webapi_overview/auth

## OAuth

Partner-only; status and alternatives in [`non-partner.md`](non-partner.md). For website
login use OpenID 2.0 ([`openid.md`](openid.md)).
