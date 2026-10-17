#!/bin/bash
while IFS= read -r l; do case "$l" in ""|\#*) ;; *=*) k=${l%%=*}; v=${l#*=}; v=${v#\"}; v=${v%\"}; v=${v#\x27}; v=${v%\x27}; export "$k=$v";; esac; done < <(sudo -n cat /etc/rg/rg.env)
cd /home/ubuntu/build/rg/repo/apps/rg-website && bun run build
echo EXIT=$?
