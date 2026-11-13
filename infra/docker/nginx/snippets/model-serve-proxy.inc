# Derived IEVR asset served by nie-model-serve, cached on disk (one model
assembly costs # seconds of CPU). Only 200 and 404 are stored. limit_req
zone=nie_assets burst=40 nodelay; limit_conn nie_conn 8; limit_req_status 429;
limit_conn_status 429; proxy_pass http://model_serve; # model-serve sends its
own Access-Control-Allow-Origin; the one added below must be the only one.
proxy_hide_header Access-Control-Allow-Origin; proxy_http_version 1.1;
proxy_set_header Host $host; proxy_set_header Connection ""; include
/etc/nginx/snippets/proxy-client-ip.inc; proxy_set_header X-Forwarded-Proto
$rg_proto; proxy_cache nie_derived; proxy_cache_key https$host$uri$is_args$args;
proxy_cache_valid 200 30d; proxy_cache_valid 404 5m; proxy_cache_lock on;
proxy_cache_use_stale error timeout updating http_500 http_502 http_503
http_504; add_header X-Cache-Status $upstream_cache_status always; add_header
Access-Control-Allow-Origin "*" always;
