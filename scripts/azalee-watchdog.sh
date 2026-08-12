#!/usr/bin/env bash
# azalee-watchdog.sh — auto-réparation azalee-web.
# `Restart=always` (systemd) ne couvre QUE les crashs/exits ; il ne détecte PAS le cas
# « process vivant mais figé » (thrash mémoire, event-loop bloqué) → 504 persistant.
# Ce watchdog (lancé par azalee-watchdog.timer toutes les 60s) :
#   - sonde 3× la santé du slot VIVANT ; restart si 3/3 KO (code 000/502/503/504),
#   - restart PRÉVENTIF (graceful SIGTERM) si la RAM cgroup approche le MemoryMax,
#   - relance le slot vivant s'il est simplement arrêté (cas d'un redémarrage machine
#     alors qu'un déploiement s'était arrêté sur la doublure, non activée au boot),
#   - ne fait RIEN si un restart est déjà en cours, ni pendant un déploiement, ni sur
#     une 5xx applicative (500 = app vivante mais buggée : un restart bouclerait sans
#     corriger un mauvais build).
#
# Bleu/vert : le slot servi par nginx alterne pendant un déploiement. On lit donc
# l'unité et le port vivants dans `live.env` (écrit par scripts/ops/deploy.ts) au lieu
# de les figer ici — sonder :3003 pendant que le trafic est sur :3013 déclencherait un
# redémarrage en boucle du slot qu'on est justement en train de remettre à niveau.
set -uo pipefail

RELEASES=/home/ubuntu/rg-releases/azalee
SVC="azalee-web.service"
PORT=3003
# shellcheck source=/dev/null
[ -f "$RELEASES/live.env" ] && . "$RELEASES/live.env"
SVC="${LIVE_UNIT:-$SVC}"
PORT="${LIVE_PORT:-$PORT}"
URL="http://127.0.0.1:${PORT}/"
MEM_RESTART_GIB=26   # cap Max=28G → restart propre avant l'OOM-kill brutal

# Un déploiement arrête, redémarre et bascule les slots : toute sonde pendant cette
# fenêtre est un faux positif, et un `systemctl restart` concurrent casserait la bascule.
if [ -e "$RELEASES/deploy.lock" ]; then
	echo "azalee-watchdog: skip (déploiement en cours)"
	exit 0
fi

state="$(systemctl show "$SVC" -p ActiveState --value 2>/dev/null)"
sub="$(systemctl show "$SVC" -p SubState --value 2>/dev/null)"
if [ "$sub" = "start" ] || [ "$sub" = "start-pre" ] || [ "$state" = "activating" ] || [ "$state" = "deactivating" ]; then
	echo "azalee-watchdog: skip (restart en cours : $state/$sub)"
	exit 0
fi

# Slot vivant à l'arrêt : personne ne sert le trafic, on le relance sans attendre les
# trois sondes (elles échoueraient de toute façon, mais 10 s plus tard).
if [ "$state" != "active" ]; then
	echo "azalee-watchdog: RESTART — $SVC est $state (slot vivant arrêté)"
	systemctl start "$SVC"
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
	echo "azalee-watchdog: RESTART — $SVC ($PORT) — $reason"
	systemctl restart "$SVC"
else
	echo "azalee-watchdog: OK ($SVC :$PORT http=$last mem=${mem_gib}G)"
fi
