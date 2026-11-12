# Sign in through Steam (OpenID 2.0)

Steam is an OpenID 2.0 provider. It authenticates the user and returns their SteamID64; it
provides no profile attributes (no Simple Registration or Attribute Exchange data), so the
profile comes from the Web API afterwards (source: https://partner.steamgames.com/doc/features/auth,
section "Website").

- OP endpoint: `https://steamcommunity.com/openid/login`
- Discovery document (XRDS): `https://steamcommunity.com/openid` (unverified: returned
  `application/xrds+xml` in past observations; the fixed endpoint above is enough).
- Claimed identifier format: `https://steamcommunity.com/openid/id/<steamid64>`

## Step 1: redirect (checkid_setup)

GET `https://steamcommunity.com/openid/login` with:

| Parameter           | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| `openid.ns`         | `http://specs.openid.net/auth/2.0`                                                |
| `openid.mode`       | `checkid_setup`                                                                   |
| `openid.return_to`  | absolute callback URL on the site, e.g. `https://example.com/auth/steam/callback` |
| `openid.realm`      | site origin, e.g. `https://example.com/` (must cover `return_to`)                 |
| `openid.identity`   | `http://specs.openid.net/auth/2.0/identifier_select`                              |
| `openid.claimed_id` | `http://specs.openid.net/auth/2.0/identifier_select`                              |

Parameter semantics: OpenID 2.0 spec section 9.1
(https://openid.net/specs/openid-authentication-2_0.html#requesting_authentication).

## Step 2: the positive assertion

Steam redirects to `return_to` with `openid.mode=id_res` and, among others,
`openid.op_endpoint`, `openid.claimed_id`, `openid.identity`, `openid.return_to`,
`openid.response_nonce`, `openid.assoc_handle`, `openid.signed`, `openid.sig`
(spec section 10.1). A user cancel returns `openid.mode=cancel`.

## Step 3: verify (check_authentication)

POST `application/x-www-form-urlencoded` to `https://steamcommunity.com/openid/login` with
every received `openid.*` field unchanged except `openid.mode=check_authentication`
(spec section 11.4.2). The response is key-value form:

```
ns:http://specs.openid.net/auth/2.0
is_valid:true
```

Accept only `is_valid:true`. Then also check, on the server:

1. `openid.op_endpoint` equals `https://steamcommunity.com/openid/login`.
2. `openid.return_to` equals the URL the request actually arrived on (spec 11.1).
3. `openid.claimed_id` matches `^https://steamcommunity.com/openid/id/(\d{17})$`. The
   capture is the SteamID64.
4. `openid.response_nonce` has not been seen before (replay protection, spec 11.3). Store
   nonces for the allowed clock skew window.

## Pitfalls

- Parsing the SteamID from `claimed_id` without the `check_authentication` call allows
  anyone to forge a login.
- Rebuilding the POST body from a whitelist can drop signed fields: send back exactly what
  was received.
- The flow is browser-only; it does not yield a token usable against the Web API on the
  user's behalf.
- Many libraries exist (passport-steam, node-openid); the steps above are what they do.
  Verify that a chosen library performs step 3 and the nonce check.

## After login

Call `ISteamUser/GetPlayerSummaries/v2/?steamids=<id64>` with a Web API key (MCP tool
`web_api_call`) for persona name, avatar and profile URL. Visibility fields depend on the
user's privacy settings (see steam-web-api skill).
