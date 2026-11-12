# CM server discovery

Endpoint: `https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cellid=0&maxcount=<n>`

Live sample (fetched 2026-11-12):

```json
{"endpoint":"ext1-par1.steamserver.net:27035","type":"websockets","dc":"par1","realm":"steamglobal","load":28}
{"endpoint":"185.25.182.20:27017","type":"netfilter","dc":"par1","realm":"steamglobal","load":28}
{"endpoint":"ext2-par1.steamserver.net:27019","type":"websockets","dc":"par1"}
```

- `netfilter`: raw TCP/UDP CM, observed on port 27017. The 27017-27019 range is commonly cited (unverified for the full range).
- `websockets`: TLS WebSocket CM. Ports observed: 27019, 27021, 27025, 27035. Port 443 is commonly used (unverified in this sample). The URL path used by clients is (unverified); read SteamKit's WebSocket connection code under `steamkit/SteamKit2/SteamKit2/Networking/Steam3/` before hardcoding it.
- Choose servers by lowest `wtd_load`; pass `cellid` for locality.
- SteamKit discovery code: `C:\src\third_party\steam-ecosystem\steamkit\SteamKit2\SteamKit2\Steam\Discovery\`.
