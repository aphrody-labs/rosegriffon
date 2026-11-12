# Lancache and Steam

Sources: https://lancache.net/docs/ (fetched 2026-11-12), `third_party/steam-ecosystem/lancache-dns`, `third_party/steam-ecosystem/lancache-monolithic`, `third_party/steam-ecosystem/steam-lancache-prefill`, `third_party/steam-ecosystem/steamkit/SteamKit2/SteamKit2/Steam/CDN/ClientLancache.cs`.

## DNS

- lancache-dns clones `https://github.com/uklans/cache-domains.git` (`third_party/steam-ecosystem/lancache-dns/Dockerfile`) and answers the listed CDN domains with `LANCACHE_IP`.
- Clients must use lancache-dns as their only DNS server; other resolvers go in `UPSTREAM_DNS`.

## Detection

Steam clients and tools resolve `lancache.steamcontent.com`. If it returns a private (LAN) address, requests go to that cache. SteamKit (`ClientLancache.cs`, `TriggerDomain`) and steam-lancache-prefill (`AppConfig.SteamTriggerDomain`) use this name. When going through the cache, SteamKit sets the `Host` header to `lancache.steamcontent.com`.

## Monolithic cache (nginx)

- `slice 1m;` and `proxy_set_header Range $slice_range;` (`third_party/steam-ecosystem/lancache-monolithic/overlay/etc/nginx/sites-available/cache.conf.d/root/20_cache.conf`).
- `proxy_cache_key $cacheidentifier$uri$slice_range;` (`third_party/steam-ecosystem/lancache-monolithic/overlay/etc/nginx/sites-available/cache.conf.d/root/30_cache_key.conf`); `$cacheidentifier` is mapped from user agent and host (`third_party/steam-ecosystem/lancache-monolithic/overlay/etc/nginx/conf.d/30_maps.conf`), so all Steam CDN hosts share one cache namespace.
- HTTP only. HTTPS is passed through an SNI proxy and not cached.
- Storage settings: `CACHE_ROOT`, `CACHE_DISK_SIZE`, `CACHE_INDEX_SIZE`, `MIN_DISK_FREE`.

## Prefill

steam-lancache-prefill logs in, lets the user pick owned apps interactively, downloads their chunks through the cache, and discards the data. Docs: https://tpill90.github.io/steam-lancache-prefill/

## In this repo

Rules ported to Alpine nginx in `apps/rosegriffon/infra/docker/lancache/` (per `apps/rosegriffon/crates/bun-steam/UPSTREAM.md`); the upstream image is Ubuntu-based. nginx listens on port 80 inside the container (`nginx.conf`, `listen 80`), published on the host as `${LANCACHE_BIND:-127.0.0.1}:${LANCACHE_PORT:-8081}`, so loopback port 8081 by default (`apps/rosegriffon/infra/docker/lancache/compose.yaml`, `ports`).
