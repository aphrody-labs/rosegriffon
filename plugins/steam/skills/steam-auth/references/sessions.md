# Account sessions: IAuthenticationService

Defined in `third_party/steam-ecosystem/steam-protobufs/steam/steammessages_auth.steamclient.proto`
as `service Authentication` (exposed over the CM as `Authentication.<Method>#1` and over
HTTPS as `https://api.steampowered.com/IAuthenticationService/<Method>/v1/`).

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
logs in a CM client; a WebBrowser token yields web cookies (`steamLoginSecure`).

`EAuthSessionGuardType` (proto lines 21-28): `None = 1`, `EmailCode = 2`,
`DeviceCode = 3` (TOTP from the mobile authenticator), `DeviceConfirmation = 4`,
`EmailConfirmation = 5`, `MachineToken = 6`, `LegacyMachineAuth = 7`.

## Tokens

- Both tokens are JWTs. The payload holds `sub` (SteamID64), `aud` (audiences such as
  `client`, `web`, `renew`, `derive`), `exp`, and `iss`. Decode the payload for expiry
  checks only; the signature is Valve's and is not verifiable offline.
- Refresh tokens are long-lived (months); access tokens are short-lived (about a day)
  (unverified durations, observed behaviour reported by node-steam-session).
- A CM login uses the refresh token in `CMsgClientLogon.access_token`
  (unverified field name; see node-steam-user `components/connection` handling).

## Steam Guard

- Email codes: 5 characters, sent on new-device logins.
- Mobile authenticator: TOTP over HMAC-SHA1 with the account `shared_secret`, 30-second
  steps, rendered as 5 characters from the alphabet `23456789BCDFGHJKMNPQRTVWXY`
  (implementation reference: third_party/steam-ecosystem/valvepython-steam
  `steam/guard.py`).
- Trade and market confirmations are signed with `identity_secret` (same file).
- Machine tokens (`guardData` in node-steam-session) let a known device skip email codes.

## What bun-steam implements

`apps/rosegriffon/crates/bun-steam/src/depot/auth.rs` renews a stored refresh token with
`Authentication.GenerateAccessTokenForApp#1`, encoding the request by hand with the field
numbers from the proto. It reads JWT claims without verifying the signature (expiry only)
and redacts tokens in logs. `token_store.rs` keeps a per-account cache of `refreshToken`
and `guardData`. bun-steam has no OpenID, web-ticket or interactive credential login code;
interactive login is delegated to tools such as node-steam-session or steamroom.

## Libraries

- node-steam-session (`LoginSession`): full flow, QR and credentials, for SteamClient,
  WebBrowser and MobileApp platforms.
- SteamKit2 `SteamAuthentication` (`SteamKit2/Steam/Authentication`): same flow in C#.
- steamroom and steam-vent: Rust CM clients (see steam-community-tools skill).
