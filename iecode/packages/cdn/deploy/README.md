# CDN streaming LIVE des CPK IEVR (g4tx -> PNG à la volée)

Le but du projet : servir les assets du jeu en **décodant les CPK à la volée** (pas de dump disque).

- `src/server.ts` : entrypoint Bun (`serveMenuCdn`) — `loadIecode()` -> `MenuPngService` décode g4tx -> PNG depuis le CPK. Port `127.0.0.1:8788`.
- `iecode-cdn.service` : systemd (`bun src/server.ts`, DOTNET_ROOT=/usr/lib/dotnet).
- `nginx-g4tx-live.conf` : route `cdn.rosegriffon.fr/g4tx/dx11/menu/<path>.png?format=png` -> décodeur.
- Vérifié public : `GET /g4tx/dx11/menu/220_img/gallery_thumb2/thumb_story_ev06_main_0030.png?format=png` -> 200 image/png 308x180.
