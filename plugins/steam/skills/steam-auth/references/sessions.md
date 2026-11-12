# Account sessions: IAuthenticationService

Defined in `third_party/steam-ecosystem/steam-protobufs/steam/steammessages_auth.steamclient.proto`
as `service Authentication` (exposed over the CM as `Authentication.<Method>#1` and over
HTTPS as `https://api.steampowered.com/IAuthenticationService/<Method>/v1/`; a keyless
`GetPasswordRSAPublicKey/v1/?account_name=test` call returned `response.publickey_mod`, and
`ISteamWebAPIUtil/GetSupportedAPIList/v1/` lists `IAuthenticationService`, both 2026-11-12).

## RPCs (proto lines 381-395)

| RPC                                                    | Purpose                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `GetPasswordRSAPublicKey`                              | RSA key (modulus, exponent, timestamp) used to encrypt the password client-side |
| `BeginAuthSessionViaCredentials`                       | Start a session with account name and encrypted password                        |
| `BeginAuthSessionViaQR`                                | Start a session shown as a QR code, approved from the mobile app                |
| `UpdateAuthSessionWithSteamGuardCode`                  | Submit an email or TOTP code                                                    |
| `UpdateAuthSessionWithMobileConfirmation`              | Approve from the mobile app                                                     |
| `PollAuthSessionStatus`                                | Poll until the session yields `refresh_token` and `access_token`                |
| `GetAuthSessionInfo`, `GetAuthSessionRiskInfo`         | Details shown to the approving device                                           |
| `GenerateAccessTokenForApp`                            | Renew an access token (and optionally rotate the refresh token)                 |
| `EnumerateTokens`, `RevokeToken`, `RevokeRefreshToken` | Manage issued tokens                                                            |

## Enums

`EAuthTokenPlatformType` (proto lines 8-11): `SteamClient = 1`, `WebBrowser = 2`,
`MobileApp = 3`. The platform type decides the token audience: a SteamClient refresh token
logs in a CM client; a WebBrowser token yields the `steamLoginSecure` and `sessionid`
web cookies (`third_party/steam-ecosystem/node-steam-session/src/LoginSession.ts` line 821).

`EAuthSessionGuardType` (proto lines 21-28): `None = 1`, `EmailCode = 2`,
`DeviceCode = 3` (TOTP from the mobile authenticator), `DeviceConfirmation = 4`,
`EmailConfirmation = 5`, `MachineToken = 6`, `LegacyMachineAuth = 7`.

## Tokens

- Both tokens are JWTs carrying `sub` (SteamID64), `aud` and `exp`. node-steam-session
  tells them apart by audience: a token whose `aud` includes `derive` is a refresh token;
  an access token must include `client` (SteamClient platform) or `web` (WebBrowser)
  (`third_party/steam-ecosystem/node-steam-session/src/LoginSession.ts` lines 244-309).
  Decode the payload for expiry checks only; read the real lifetime from `exp` rather than
  assuming one.
- `GenerateAccessTokenForApp` can also rotate the refresh token (`renewal_type` Allow);
  the old refresh token stops working after a successful renewal
  (`third_party/steam-ecosystem/node-steam-session/src/AuthenticationClient.ts` line 288,
  `third_party/steam-ecosystem/node-steam-session/src/LoginSession.ts` line 961).
- A CM login sends the refresh token in `CMsgClientLogon.access_token` (field 108,
  `third_party/steam-ecosystem/steam-protobufs/steam/steammessages_clientserver_login.proto`).

## Steam Guard

- Mobile authenticator codes: HMAC-SHA1 of the 30-second time step keyed with the account
  `shared_secret`, rendered as 5 characters from `23456789BCDFGHJKMNPQRTVWXY`
  (`third_party/steam-ecosystem/valvepython-steam/steam/guard.py` lines 509-521).
- Confirmation keys are derived from `identity_secret` (`generate_confirmation_key`, same
  file).
- A wrong email code fails with EResult InvalidLoginAuthCode (65)
  (`third_party/steam-ecosystem/node-steam-session/README.md` line 397).
- A Steam Guard machine token (`steamGuardMachineToken` in node-steam-session) lets a known
  device bypass email code verification (`third_party/steam-ecosystem/node-steam-session/README.md` lines 244-293).
  bun-steam stores the same value as `guardData` (`apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/src/depot/token_store.rs`).

## What bun-steam implements

`apps/rosegriffon/aphrody-dev/steam-depot (src crates/steam-depot)/src/depot/auth.rs` renews a stored refresh token with
`Authentication.GenerateAccessTokenForApp#1`, encoding the request by hand with the field
numbers from the proto. It reads JWT claims without verifying the signature (expiry only)
and redacts tokens in logs. `token_store.rs` keeps a per-account cache of `refreshToken`
and `guardData`. bun-steam has no OpenID, web-ticket or interactive credential login code;
interactive login is delegated to node-steam-session.

## Libraries

- node-steam-session (`LoginSession`): full flow, QR and credentials, for SteamClient,
  WebBrowser and MobileApp platforms.
- SteamKit2 `SteamAuthentication` (`third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Steam/Authentication`): same flow in C#.
- steamroom and steam-vent: Rust CM clients (see [`../../steam-community-tools/SKILL.md`](../../steam-community-tools/SKILL.md)).
