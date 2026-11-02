#!/bin/bash
# Entretien hebdomadaire des disques du VPS (installé par /etc/cron.d/rg-disk-hygiene).
#  - /home est un btrfs sur sdb1+sdc1 : une fois toutes les puces allouées, plus rien ne s'écrit même
#    avec des Go « libres ». Le balance rend les puces à moitié vides au pool.
#  - Les caches de build Cargo (`target/debug`, `build/rust/debug`) pèsent des centaines de Go :
#    on supprime ceux qui n'ont pas été touchés depuis 14 jours (ils se régénèrent).
#  - Alerte dans le journal quand / ou /home dépasse 90 %.
set -u
LOG=/home/ubuntu/logs/disk-hygiene.log
exec >>"$LOG" 2>&1
echo "== $(date -Is)"

for m in / /home; do
  pct=$(df --output=pcent "$m" | tail -1 | tr -dc 0-9)
  echo "$m ${pct}%"
  [ "$pct" -ge 90 ] && logger -p user.warning -t rg-disk "$m à ${pct} %"
done

# Cibles de build périmées (aucune écriture depuis 14 jours), jamais les sources.
for d in /home/ubuntu/src/bun-os/build/rust/debug /home/ubuntu/src/bun-os/target/debug; do
  if [ -d "$d" ] && [ -z "$(find "$d" -maxdepth 1 -mtime -14 -print -quit 2>/dev/null)" ]; then
    echo "purge $d"; rm -rf "$d"
  fi
done

# Rend au pool btrfs les puces de données remplies à moins de 15 %.
sudo -n btrfs balance start -dusage=15 -musage=15 /home
df -h /home | tail -1
