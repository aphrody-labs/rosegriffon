listen 8443 ssl;
http2 on;
ssl_protocols TLSv1.2 TLSv1.3;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
