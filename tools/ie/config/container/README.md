# IECODE runtime containers

This directory owns the IECODE SteamCMD, Steam client, and isolated PostgreSQL
Compose profiles. The previous BunOS release packager is not part of this
workspace; these files configure runtime containers only.

## Storage profile

From the yolo-re root, inspect the profile with:

```sh
bun tools/ie/iecode-tools/storage-runtime.ts status
```

The command checks ownership labels and database contents before selecting a
source. `setup` provisions only an absent profile and refuses to overwrite an
existing database or volume. SQLite backups are verified read-only snapshots;
new snapshots and runtime credentials stay outside the repository.

## SteamCMD and Steam client

Set `IEVR_GAME_DIR` in the protected host-side `~/.config/nie/steam.env` to the
absolute game-data directory. SteamCMD and the Steam UI use that same directory;
the UI mount is read-only. Keep authentication in the interactive Steam session
or its private host volume, never in command arguments or repository files.

```sh
docker compose --env-file ~/.config/nie/steam.env -f tools/ie/config/container/compose.steamcmd.json build steamcmd
docker compose --env-file ~/.config/nie/steam.env -f tools/ie/config/container/compose.steamcmd.json --profile steamcmd run --rm steamcmd
```

The first SteamCMD run persists its updated client in `ie-steam-state`.
Proton state lives in `ie-proton-runtime`; Steam UI authentication lives in
`ie-steam-client-state`. The UI publishes noVNC on VPS loopback port 6080 only.
Reach it through the existing SSH alias and tunnel:

```sh
scp tools/ie/config/container/apparmor-steam-client vps:/tmp/iecode-apparmor-steam-client
ssh vps 'sudo install -D -m 0644 /tmp/iecode-apparmor-steam-client /etc/apparmor.d/containers/iecode-steam-client && sudo apparmor_parser -r -W /etc/apparmor.d/containers/iecode-steam-client'
docker compose --env-file ~/.config/nie/steam.env -f tools/ie/config/container/compose.steamcmd.json --profile steam-client up -d --build steam-client
ssh -N -L 6080:127.0.0.1:6080 vps
```

Open `http://127.0.0.1:6080/vnc.html` and authenticate in Steam. The container
uses a dedicated seccomp profile and AppArmor policy. Do not disable either
policy globally. The game-data mount remains read-only in the Steam UI.

`cloudflare-product.json` records infrastructure targets only; this repository
does not ship a provisioning command for those targets.
