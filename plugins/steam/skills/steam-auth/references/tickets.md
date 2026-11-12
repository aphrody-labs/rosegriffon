# Session tickets

Source for this page unless stated: https://partner.steamgames.com/doc/features/auth and
https://partner.steamgames.com/doc/api/ISteamUser.

## Web API tickets (game client to backend)

1. Client: `ISteamUser::GetAuthTicketForWebApi(const char *pchIdentity)` returns an
   `HAuthTicket`; the ticket bytes arrive in the `GetTicketForWebApiResponse_t` callback.
   `pchIdentity` is a free string naming the receiving service (for example
   `"my-backend"`). Declared in the SDK header `isteamuser.h` as
   `virtual HAuthTicket GetAuthTicketForWebApi( const char *pchIdentity )`
   (`third_party/steam-ecosystem/steamworks-rs/steamworks-sys/lib/steam/public/steam/isteamuser.h` line 136).
2. Client sends the hex-encoded ticket to the backend over its own channel (HTTPS).
3. Backend: `GET https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/`
   with a publisher key, or `https://api.steampowered.com/` with a user Web API key (rate
   limited). All four parameters are required: `key` (sent in the `x-webapi-key` header, see [`keys.md`](keys.md)), `appid`, `ticket` (hex of the ticket
   bytes) and `identity` (the string passed to `GetAuthTicketForWebApi`). Call it from a
   secure server only, never from a client
   (https://partner.steamgames.com/doc/webapi/ISteamUserAuth, fetched 2026-11-12).
4. Response: `response.params` with `result`, `steamid`, `ownersteamid`, `vacbanned` and
   `publisherbanned` (field names from
   `third_party/steam-ecosystem/steam-rs/src/steam_user_auth/authenticate_user_ticket.rs`).
5. When the session ends, the client calls `ISteamUser::CancelAuthTicket(hTicket)`.

## Game server and P2P tickets

Signatures below are from the Steamworks SDK headers vendored in
`third_party/steam-ecosystem/steamworks-rs/steamworks-sys/lib/steam/public/steam/`.

- Sender: `GetAuthSessionTicket(void *pTicket, int cbMaxTicket, uint32 *pcbTicket, const SteamNetworkingIdentity *)`
  on `ISteamUser` (isteamuser.h line 131) or `ISteamGameServer` (isteamgameserver.h line 157).
- Receiver: `BeginAuthSession(const void *pAuthTicket, int cbAuthTicket, CSteamID steamID)`
  (isteamuser.h line 140, isteamgameserver.h line 161), which the header describes as
  checking that the ticket "is valid and isnt reused"; the result arrives in the
  `ValidateAuthTicketResponse_t` callback (isteamuser.h line 319). Stop with
  `EndAuthSession(steamID)`; the sender releases its ticket with `CancelAuthTicket`.
- After `BeginAuthSession`, `UserHasLicenseForApp(steamID, appID)` checks DLC ownership
  (isteamuser.h line 150, isteamgameserver.h line 171).

## Encrypted app tickets

`ISteamUser::RequestEncryptedAppTicket(void *pDataToInclude, int cbDataToInclude)`
(isteamuser.h line 165) yields a ticket that the backend decrypts offline with the functions
in `steamencryptedappticket.h` (same SDK directory), such as
`SteamEncryptedAppTicket::BDecryptTicket`, with a private symmetric key generated per title
under Edit Steamworks Settings, Security, SDK Auth (needs the Manage Signing permission). The
key must be stored securely and never shipped in the application
(https://partner.steamgames.com/doc/features/auth, fetched 2026-11-12).
