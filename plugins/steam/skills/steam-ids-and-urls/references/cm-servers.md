# CM server discovery

Endpoint: `https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cellid=0&maxcount=<n>`

Live sample (fetched 2026-11-12):

```json
{"endpoint":"ext1-par1.steamserver.net:27024","legacy_endpoint":"ext1-par1.steamserver.net:27024","type":"websockets","dc":"par1","realm":"steamglobal","load":28,"wtd_load":19.1386098861694336}
{"endpoint":"162.254.197.39:27017","legacy_endpoint":"162.254.197.39:27017","type":"netfilter","dc":"fra1","realm":"steamglobal","load":7,"wtd_load":84.6984069347381592}
```

Every entry carries `endpoint`, `legacy_endpoint`, `type`, `dc`, `realm`, `load` and `wtd_load`; the entry order and values differ between calls.

- `netfilter`: raw TCP/UDP CM. A full `cellid=0` response on 2026-11-12 listed 11 `netfilter` entries, all on port 27017.
- `websockets`: TLS WebSocket CM. The same response listed ports 443 (9 entries) and 27018 to 27038. The WebSocket URL is `wss://<endpoint>/cmsocket/` (`uri.Path = "/cmsocket/"` in `third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Networking/Steam3/WebSocketContext.cs`).
- Ports change; always take endpoints from the response.
- SteamKit reads only `endpoint` and `type` from this response (`third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Steam/WebAPI/SteamDirectory.cs`, `websockets` and `netfilter` cases); it does not read `load` or `wtd_load`.
- SteamKit discovery code: `third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Steam/Discovery/`.
