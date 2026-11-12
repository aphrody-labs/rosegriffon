# SPDX-License-Identifier: Apache-2.0
# Shared body of the cdn edge vhosts. Install as /etc/nginx/snippets/rosegriffon-cdn-edge.inc.
ssl_protocols TLSv1.2 TLSv1.3;
server_tokens off;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header X-Rg-Edge "cdn" always;

# Cut-in camera tracks are the only raw game bytes the site reads (first matching regex wins).
location ~ ^/raw/.+\.g4cm$ {
    try_files /nonexistent @origin;
}

# The game itself (original bytes, install listing, project source) is never public.
location ~ ^/(raw|vfs|depot)(/|$) {
    return 404;
}

location ^~ /static/ {
    root /srv/rosegriffon/cdn;
    add_header Access-Control-Allow-Origin "*" always;
    add_header Cache-Control "public, max-age=86400" always;
    add_header X-Rg-Edge "cdn-disk" always;
    try_files $uri @origin;
}

location / {
    try_files /nonexistent @origin;
}

location @origin {
    proxy_pass https://rg_origin;
    proxy_ssl_server_name on;
    proxy_ssl_name cdn.rosegriffon.fr;
    proxy_ssl_verify on;
    proxy_ssl_verify_depth 3;
    proxy_ssl_trusted_certificate /etc/ssl/certs/ca-certificates.crt;
    proxy_ssl_session_reuse on;
    proxy_http_version 1.1;
    proxy_set_header Host cdn.rosegriffon.fr;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $rg_cdn_connection;
    proxy_cache rg_cdn;
    proxy_cache_key $request_uri;
    proxy_cache_valid 200 206 7d;
    proxy_cache_valid 404 1m;
    proxy_cache_use_stale error timeout updating http_502 http_503 http_504;
    proxy_cache_lock on;
    proxy_cache_background_update on;
    add_header X-Cache-Status $upstream_cache_status always;
    proxy_read_timeout 120s;
}
