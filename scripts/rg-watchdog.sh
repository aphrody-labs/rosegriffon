#!/usr/bin/env bash
# rg-watchdog.sh — auto-réparation générique d'un service HTTP de production.
#
# POURQUOI CE SCRIPT REMPLACE azalee-watchdog.sh
# `Restart=always` ne couvre que les crashs : il ne voit pas le cas « process vivant
# mais figé » (thrash mémoire, boucle d'événements bloquée) qui produit un 504
# persistant. Un watchdog existait pour ça, mais pour azalée seule — l'audit du
# 14/8/2026 a compté treize autres services de production sans aucune sonde de santé,
# dont nie-model-serve, précisément celui qui sortait en code 0 puis répondait 502.
# La logique était déjà bonne ; seules l'unité, le port et le seuil étaient figés.
# Ils sont désormais lus dans la table ci-dessous, et systemd instancie un timer par
# service (`rg-watchdog@<service>.timer`).
#
# CE QU'IL FAIT
#   - sonde 3× la santé du service ; redémarre si 3/3 échouent (000/502/503/504),
#   - redémarre préventivement (SIGTERM propre) si la RAM du cgroup approche MemoryMax,
#   - relance le service s'il est simplement arrêté,
#   - ne fait RIEN pendant un déploiement, ni pendant un redémarrage déjà en cours,
#     ni sur une 5xx applicative (500 = application vivante mais fautive : un
#     redémarrage bouclerait sans corriger un mauvais build).
#
# Usage : rg-watchdog.sh <nom-du-service-sans-.service>
set -uo pipefail

CIBLE="${1:-}"
[ -n "$CIBLE" ] || { echo "usage: rg-watchdog.sh <service>" >&2; exit 2; }

# Table de surveillance : service | port | seuil mémoire (Gio) | chemin de santé | dossier
# de versions (bleu/vert) s'il y en a un.
#
# Le seuil vaut ~85 % du MemoryMax de l'unité : assez haut pour ne pas redémarrer un
# service qui travaille, assez bas pour reprendre la main avant que le noyau ne tue le
# processus au milieu d'une requête.
case "$CIBLE" in
	azalee-web)      PORT=3003; SEUIL_GIB=10;  SANTE="/";       RELEASES=/home/ubuntu/rg-releases/azalee ;;
	website-web)     PORT=3004; SEUIL_GIB=3.4; SANTE="/";       RELEASES=/home/ubuntu/rg-releases/website ;;
	azalee-api)      PORT=8807; SEUIL_GIB=1.6; SANTE="/";       RELEASES="" ;;
	nie-model-serve) PORT=8790; SEUIL_GIB=8.5; SANTE="/health"; RELEASES="" ;;
	rg-postgrest)    PORT=8809; SEUIL_GIB=1.6; SANTE="/";       RELEASES="" ;;
	rg-storage)      PORT=8810; SEUIL_GIB=0.8; SANTE="/";       RELEASES="" ;;
	rag-api)         PORT=8806; SEUIL_GIB=1.6; SANTE="/";       RELEASES="" ;;
	cdn-variants)    PORT=8805; SEUIL_GIB=2.6; SANTE="/";       RELEASES="" ;;
	rg-cdn)          PORT=8804; SEUIL_GIB=0.8; SANTE="/health"; RELEASES="" ;;
	*) echo "rg-watchdog: service inconnu « $CIBLE » — l'ajouter à la table" >&2; exit 2 ;;
esac

SVC="$CIBLE.service"

# Bleu/vert : pendant un déploiement, le trafic passe sur la doublure. Sonder le slot A
# alors que le trafic est sur le slot B redémarrerait en boucle celui qu'on est en train
# de remettre à niveau — d'où la lecture de l'unité et du port réellement servis.
if [ -n "$RELEASES" ]; then
	# shellcheck source=/dev/null
	[ -f "$RELEASES/live.env" ] && . "$RELEASES/live.env"
	SVC="${LIVE_UNIT:-$SVC}"
	PORT="${LIVE_PORT:-$PORT}"
	if [ -e "$RELEASES/deploy.lock" ]; then
		echo "rg-watchdog[$CIBLE]: skip (déploiement en cours)"
		exit 0
	fi
fi

URL="http://127.0.0.1:${PORT}${SANTE}"

etat="$(systemctl show "$SVC" -p ActiveState --value 2>/dev/null)"
sous="$(systemctl show "$SVC" -p SubState --value 2>/dev/null)"
if [ "$sous" = "start" ] || [ "$sous" = "start-pre" ] || [ "$etat" = "activating" ] || [ "$etat" = "deactivating" ]; then
	echo "rg-watchdog[$CIBLE]: skip (redémarrage en cours : $etat/$sous)"
	exit 0
fi

if [ "$etat" != "active" ]; then
	echo "rg-watchdog[$CIBLE]: DÉMARRAGE — $SVC est $etat"
	systemctl start "$SVC"
	exit 0
fi

echecs=0
dernier=000
for i in 1 2 3; do
	dernier="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$URL" 2>/dev/null || echo 000)"
	case "$dernier" in
		000|502|503|504) echecs=$((echecs + 1)) ;;
		*) echecs=0; break ;;   # toute réponse < 500 (200/301/404…) prouve que le service répond
	esac
	[ "$i" -lt 3 ] && sleep 5
done

mem="$(systemctl show "$SVC" -p MemoryCurrent --value 2>/dev/null)"
case "$mem" in ''|'[not set]'|*[!0-9]*) mem=0 ;; esac
mem_gib="$(awk "BEGIN{printf \"%.1f\", $mem/1073741824}")"

raison=""
[ "$echecs" -ge 3 ] && raison="santé KO 3/3 (dernier=$dernier)"
if awk "BEGIN{exit !($mem_gib > $SEUIL_GIB)}"; then
	raison="${raison:+$raison + }mémoire ${mem_gib} Gio > ${SEUIL_GIB} Gio (préventif)"
fi

if [ -n "$raison" ]; then
	echo "rg-watchdog[$CIBLE]: REDÉMARRAGE — $SVC (:$PORT) — $raison"
	systemctl restart "$SVC"
else
	echo "rg-watchdog[$CIBLE]: OK ($SVC :$PORT http=$dernier mem=${mem_gib} Gio)"
fi
