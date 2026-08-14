# Directives de proximité communes aux blocs qui proxifient azalée.
#
# Extraites parce que le vhost a désormais deux chemins vers le même amont — le bloc
# général `location /`, qui streame, et le bloc des pages de catalogue, qui met en
# cache — et que la première divergence entre les deux copies serait invisible.
# `proxy_pass`, `proxy_buffering` et les directives de cache restent hors d'ici : ce
# sont précisément les points où les deux blocs diffèrent.
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
# Fail-fast : connexion 3 s, lecture 30 s (backend figé → maintenance, pas 60 s d'attente).
proxy_connect_timeout 3s;
proxy_read_timeout 30s;
proxy_next_upstream error timeout http_502 http_503 http_504;
