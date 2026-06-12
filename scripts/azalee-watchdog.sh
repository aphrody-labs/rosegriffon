#!/usr/bin/env bash
# azalee-watchdog.sh — auto-réparation azalee-web.
# `Restart=always` (systemd) ne couvre QUE les crashs/exits ; il ne détecte PAS le cas
# « process vivant mais figé » (thrash mémoire, event-loop bloqué) → 504 persistant.
# Ce watchdog (lancé par azalee-watchdog.timer toutes les 60s) :
#   - sonde 3× la santé locale :3003 ; restart si 3/3 KO (code 000/502/503/504),
#   - restart PRÉVENTIF (graceful SIGTERM) si la RAM cgroup approche le MemoryMax,
#   - ne fait RIEN si un restart est déjà en cours, ni sur une 5xx applicative (500
#     = app vivante mais buggée : un restart bouclerait sans corriger un mauvais build).
set -uo pipefail

SVC="azalee-web.service"
URL="http://127.0.0.1:3003/"
MEM_RESTART_GIB=16   # cap Max=18G → restart propre avant l'OOM-kill brutal

state="$(systemctl show "$SVC" -p ActiveState --value 2>/dev/null)"
sub="$(systemctl show "$SVC" -p SubState --value 2>/dev/null)"
if [ "$sub" = "start" ] || [ "$sub" = "start-pre" ] || [ "$state" = "activating" ] || [ "$state" = "deactivating" ]; then
	echo "azalee-watchdog: skip (restart en cours : $state/$sub)"
	exit 0
fi

fails=0
last=000
for i in 1 2 3; do
	last="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$URL" 2>/dev/null || echo 000)"
	case "$last" in
		000|502|503|504) fails=$((fails + 1)) ;;
		*) fails=0; break ;;   # toute réponse <500 (200/301/404…) = vivant
	esac
	[ "$i" -lt 3 ] && sleep 5
done

mem="$(systemctl show "$SVC" -p MemoryCurrent --value 2>/dev/null)"
case "$mem" in ''|'[not set]'|*[!0-9]*) mem=0 ;; esac
mem_gib="$(awk "BEGIN{printf \"%.1f\", $mem/1073741824}")"

reason=""
[ "$fails" -ge 3 ] && reason="santé KO 3/3 (dernier=$last)"
if awk "BEGIN{exit !($mem_gib > $MEM_RESTART_GIB)}"; then
	reason="${reason:+$reason + }mémoire ${mem_gib}G > ${MEM_RESTART_GIB}G (préventif)"
fi

if [ -n "$reason" ]; then
	echo "azalee-watchdog: RESTART — $reason"
	systemctl restart "$SVC"
else
	echo "azalee-watchdog: OK (http=$last mem=${mem_gib}G)"
fi
