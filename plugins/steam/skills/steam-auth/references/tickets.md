# Session tickets

Source for this page unless stated: https://partner.steamgames.com/doc/features/auth and
https://partner.steamgames.com/doc/api/ISteamUser.

## Web API tickets (game client to backend)

1. Client: `ISteamUser::GetAuthTicketForWebApi(const char *pchIdentity)` returns an
   `HAuthTicket`; the ticket bytes arrive in the `GetTicketForWebApiResponse_t` callback.
   `pchIdentity` is a free string naming the receiving service (for example
   `"my-backend"`). The function was added in a 2023 SDK release (unverified: SDK 1.57).
2. Client sends the hex-encoded ticket to the backend over its own channel (HTTPS).
3. Backend: `GET https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/`
   (or `partner.steam-api.com` with a publisher key) with:
   - `key`: Web API key or publisher key
   - `appid`: the game's AppID
   - `ticket`: hex string
   - `identity`: the same string passed to `GetAuthTicketForWebApi` (required for tickets
     made with it; reported by https://partner.steamgames.com/doc/webapi/ISteamUserAuth)
4. Success response: `response.params` with `result: "OK"`, `steamid`, `ownersteamid`,
   `vacbanned`, `publisherbanned`. `ownersteamid` differs from `steamid` when the game is
   played through Family Sharing.
5. When the session ends, the client calls `ISteamUser::CancelAuthTicket(hTicket)`.

Legacy: tickets from `GetAuthSessionTicket` were also accepted by `AuthenticateUserTicket`
without `identity`; Valve recommends `GetAuthTicketForWebApi` for web backends.

## Game server and P2P tickets

- Sender: `ISteamUser::GetAuthSessionTicket(pTicket, cbMaxTicket, &pcbTicket, pSteamNetworkingIdentity)`.
- Receiver (game server): `ISteamGameServer::BeginAuthSession(pTicket, cbTicket, steamID)`,
  then wait for `ValidateAuthTicketResponse_t`; end with `EndAuthSession(steamID)`.
- The receiver must be connected to Steam; the check is made by Steam, not offline.

## Ownership checks after identity

- `ISteamUser::UserHasLicenseForApp` (game server side) for DLC.
- Web API: `ISteamUser/CheckAppOwnership/v2` (publisher key, partner host;
  https://partner.steamgames.com/doc/webapi/ISteamUser).

## Encrypted app tickets

`ISteamUser::RequestEncryptedAppTicket` produces a ticket encrypted with a per-app key
from the partner site, decrypted offline by the backend with the SDK's
`steamencryptedappticket` library. Use it when the backend cannot call Steam.
