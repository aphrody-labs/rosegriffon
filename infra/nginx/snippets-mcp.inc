# Réglages communs au proxy MCP (inclus par mcp.rosegriffon.conf).
#
# `proxy_buffering off` + `X-Accel-Buffering: no` sont EXIGÉS par la
# spécification pour les réponses en flux : sans eux, nginx retient les
# notifications de progression jusqu'à la fin de la réponse.
#
# Installer avec le vhost :
#   sudo cp infra/nginx/snippets-mcp.inc /etc/nginx/conf.d/
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header Connection "";
proxy_buffering off;
proxy_request_buffering off;
proxy_read_timeout 600s;
proxy_send_timeout 600s;
add_header X-Accel-Buffering no;
