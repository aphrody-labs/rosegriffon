# Supported login paths without a Steamworks partner account

Steam OAuth is reserved for "partner sites and applications on embedded platforms"; Valve
assigns a Client ID on request and "will not provide you with a Client ID" to
implementations that do not plan cross-platform Cloud or Workshop support
(https://partner.steamgames.com/doc/webapi_overview/oauth, fetched 2026-11-12). The three
paths below need no partner account and cover the same use cases.

| Use case                                 | Path                                                                                            | Needs                                    | Plugin support                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Website login                            | OpenID 2.0 plus a user Web API key for profile data                                             | A user Web API key only for profile data | MCP tools `openid_login_url`, `openid_verify`, then `web_api_call` |
| Game client proves identity to a backend | `GetAuthTicketForWebApi` plus `ISteamUserAuth/AuthenticateUserTicket` on `api.steampowered.com` | A user Web API key (rate limited)        | `web_api_call`                                                     |
| Tool acts as a Steam account             | `IAuthenticationService` refresh token, renewed with `GenerateAccessTokenForApp`                | The account's own login                  | bun-steam, node-steam-session                                      |

## 1. OpenID 2.0 plus a Web API key

1. `openid_login_url` with `return_to=https://<site>/auth/steam/callback` returns the
   `checkid_setup` redirect URL.
2. On the callback, pass the full callback URL and the URL it arrived on
   (`expected_return_to`, required) to `openid_verify`. It checks `openid.mode`,
   `op_endpoint`, that `return_to` has the same scheme, host and path and contains the
   expected query parameters (OpenID 2.0 section 11.1), the
   `claimed_id` format, POSTs `check_authentication`, requires `is_valid:true`, and
   returns the SteamID in every form plus the nonce to store against replay.
3. Optionally call `ISteamUser/GetPlayerSummaries/v2` with `web_api_call` for the persona
   name and avatar (needs `STEAM_WEB_API_KEY`).

Tested 2026-11-12: a forged assertion (`openid.sig=forged`) is rejected by Steam, and
`openid_verify` reports the failure. Protocol details: [`openid.md`](openid.md).

## 2. Session tickets with a user key

`AuthenticateUserTicket` accepts a user Web API key on `https://api.steampowered.com/`
("available to game servers ... using a Web API user authentication key"; requests are rate
limited; https://partner.steamgames.com/doc/webapi/ISteamUserAuth, fetched 2026-11-12).
Required parameters: [`tickets.md`](tickets.md). With the plugin:

```json
{
  "interface": "ISteamUserAuth",
  "method": "AuthenticateUserTicket",
  "version": 1,
  "params": { "appid": 480, "ticket": "<hex>", "identity": "my-backend" }
}
```

Details and the SDK calls: [`tickets.md`](tickets.md).

## 3. Refresh token (IAuthenticationService)

A tool that must act as an account logs in once with `BeginAuthSessionViaCredentials` or
`BeginAuthSessionViaQR`, keeps the refresh token, and renews access tokens with
`GenerateAccessTokenForApp`. bun-steam implements the renewal and the token store
(`crates/steam-depot/src/depot/auth.rs`, `crates/steam-depot/src/depot/token_store.rs`); the interactive first login is
done with node-steam-session. Store the refresh token as a secret (`apps/rosegriffon/.env.example` lists `STEAM_REFRESH_TOKEN` and the `STEAM_TOKEN_STORE` backends). Details:
[`sessions.md`](sessions.md).
