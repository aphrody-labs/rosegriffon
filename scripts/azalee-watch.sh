#!/usr/bin/env bash
# Check santé azalee : HTTP public, service systemd, nginx, mémoire/swap.
ts=$(date '+%Y-%m-%d %H:%M:%S')
http=$(curl -s -m 25 -o /dev/null -w "%{http_code}:%{time_starttransfer}" -L https://azalee.rosegriffon.fr/ 2>&1)
svc=$(systemctl show azalee-web.service -p SubState --value)
mem=$(systemctl show azalee-web.service -p MemoryCurrent --value)
mem_g=$(awk "BEGIN{printf \"%.2f\", $mem/1073741824}")
ngx=$(systemctl is-active nginx)
swap=$(free -m | awk '/Swap/{printf "%d/%dMB", $3, $2}')
load=$(awk '{print $1}' /proc/loadavg)
echo "[$ts] http=$http svc=$svc nginx=$ngx mem=${mem_g}G swap=$swap load=$load"
