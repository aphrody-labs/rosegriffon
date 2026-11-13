# Host nginx -> stack nginx. Install as
/etc/nginx/snippets/rosegriffon-stack-proxy.inc. ssl_protocols TLSv1.2 TLSv1.3;
server_tokens off; add_header Strict-Transport-Security "max-age=63072000;
includeSubDomains" always; location / { proxy_pass http://rg_stack;
proxy_http_version 1.1; proxy_set_header Host $host; # The container trusts
X-Real-IP (Cloudflare real IP resolved by cloudflare-realip.conf).
proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For
$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection
$rg_stack_connection; # Colyseus rooms stay open for a whole match; the stack
nginx applies tighter per-host limits. proxy_read_timeout 3600s;
proxy_send_timeout 3600s; proxy_buffering off; proxy_request_buffering off; }
