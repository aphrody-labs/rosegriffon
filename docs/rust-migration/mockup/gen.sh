#!/usr/bin/env bash
# Generates the NIE mockup SVG frames. Usage: gen.sh <outdir> <matrix.md>
set -eu
OUT=$1; MATRIX=$2
BG='#131420'; PN='#152d52'; RW='#224271'; CY='#97c0fc'; AM='#e6c961'; BR='#c74955'; TX='#fcfaf8'; T2='#e0ecff'

txt() { # x y color size text [weight]
  printf '<text x="%s" y="%s" fill="%s" font-size="%s"%s>%s</text>\n' "$1" "$2" "$3" "$4" "${6:+ font-weight=\"$6\"}" "$5"
}
rect() { # x y w h rx attrs
  printf '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" %s/>\n' "$1" "$2" "$3" "$4" "$5" "$6"
}
status_attr() {
  case $1 in
    full) printf 'fill="%s"' "$CY" ;;
    partial) printf 'fill="%s"' "$AM" ;;
    planned) printf 'fill="none" stroke="%s"' "$CY" ;;
    *) printf 'fill="%s" fill-opacity="0.4"' "$BR" ;;
  esac
}
open_frame() { # id title active-nav
  printf '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900" font-family="Inter, Segoe UI, sans-serif">\n<title>%s</title>\n<g id="%s">\n' "$2" "$1"
  rect 0 0 1440 900 0 "id=\"bg\" fill=\"$BG\""
  echo '<g id="sidebar">'
  rect 0 0 240 900 0 "fill=\"$PN\""
  txt 24 40 "$TX" 20 "NIE" 700
  txt 24 60 "$T2" 12 "Inazuma Eleven engine"
  local i=0 y
  for n in "Bibliotheque" "Matrice" "Outils" "Parametres"; do
    y=$((100 + i * 44))
    if [ "$i" -eq "$3" ]; then
      rect 12 $((y - 22)) 216 36 8 "fill=\"$RW\""
      rect 12 $((y - 22)) 3 36 0 "fill=\"$CY\""
    fi
    txt 32 "$y" "$TX" 14 "$n"
    i=$((i + 1))
  done
  txt 24 860 "$T2" 12 "Registre rev 1 - synchronise"
  echo '</g><g id="topbar">'
  rect 264 12 420 32 8 "fill=\"$PN\""
  txt 280 33 "$T2" 14 "Rechercher un jeu, une plateforme..."
  rect 704 12 160 32 8 "fill=\"$PN\""
  txt 720 33 "$TX" 14 "Plateforme : toutes"
  rect 240 55 1200 1 0 "fill=\"$RW\""
  echo '</g>'
}
status_text() { case $1 in full | partial) printf "%s" "$BG" ;; *) printf "%s" "$TX" ;; esac; }
close_frame() { echo '</g></svg>'; }
card() { # x y title platforms state color id
  printf '<g id="card-%s">\n' "$7"
  rect "$1" "$2" 264 196 8 "fill=\"$PN\""
  rect $(($1 + 16)) $(($2 + 16)) 232 92 4 "fill=\"$RW\""
  txt $(($1 + 16)) $(($2 + 132)) "$TX" 14 "$3" 600
  txt $(($1 + 16)) $(($2 + 152)) "$T2" 12 "$4"
  rect $(($1 + 16)) $(($2 + 164)) 10 10 5 "fill=\"$6\""
  txt $(($1 + 32)) $(($2 + 173)) "$T2" 12 "$5"
  echo '</g>'
}

{
  open_frame main-shell "NIE - Shell principal" 0
  txt 264 104 "$TX" 28 "Accueil" 700
  txt 264 132 "$T2" 14 "11 jeux au registre - 2 installes - 1 mise a jour"
  for i in 0 1 2; do rect $((264 + i * 392)) 160 376 120 12 "fill=\"$PN\""; done
  txt 288 200 "$T2" 12 "Installes"; txt 288 248 "$CY" 28 "2" 700
  txt 680 200 "$T2" 12 "Mises a jour"; txt 680 248 "$AM" 28 "1" 700
  txt 1072 200 "$T2" 12 "Verifications en echec"; txt 1072 248 "$BR" 28 "0" 700
  txt 264 328 "$TX" 20 "Recents" 600
  card 264 352 "Inazuma Eleven: Victory Road" "PC - Switch - PS4 - PS5" "Installe - verifie" "$CY" ievr
  card 552 352 "Inazuma Eleven GO" "3DS" "Mise a jour du manifeste" "$AM" go1
  card 840 352 "Inazuma Eleven" "DS - 3DS" "Non installe" "$RW" ie1
  close_frame
} > "$OUT/01-main-shell.svg"

{
  open_frame library "NIE - Bibliotheque (gestionnaire de paquets)" 0
  txt 264 104 "$TX" 28 "Bibliotheque" 700
  rect 1232 80 184 36 8 "fill=\"$CY\""
  txt 1252 103 "$BG" 14 "Installer un dump" 600
  n=0
  while IFS='|' read -r id t p s c; do
    card $((264 + (n % 4) * 288)) $((140 + (n / 4) * 220)) "$t" "$p" "$s" "$c" "$id"
    n=$((n + 1))
  done <<EOF
ievr|Inazuma Eleven: Victory Road|PC - Switch - Switch 2 - PS4 - PS5|Installe - verifie|$CY
ie1|Inazuma Eleven|DS - 3DS|Non installe|$RW
ie2|Inazuma Eleven 2|DS|Non installe|$RW
ie3|Inazuma Eleven 3|DS - 3DS|Non installe|$RW
go1|Inazuma Eleven GO|3DS|Mise a jour dispo|$AM
go2|GO Chrono Stones|3DS|Non installe|$RW
go3|GO Galaxy|3DS|Non installe|$RW
strikers|Inazuma Eleven Strikers|Wii|Non installe|$RW
strikers-2012|Strikers 2012 Xtreme|Wii|Non installe|$RW
go-strikers-2013|GO Strikers 2013|Wii|Non installe|$RW
cross|Inazuma Eleven Cross|Mobile|Non installe|$RW
EOF
  close_frame
} > "$OUT/02-library.svg"

{
  open_frame feature-matrix "NIE - Matrice des fonctionnalites" 1
  txt 264 104 "$TX" 28 "Matrice des fonctionnalites" 700
  x=520
  for f in dump extract texte trad save equipe wiki runtime netplay mods; do txt "$x" 150 "$T2" 12 "$f"; x=$((x + 88)); done
  y=164
  tail -n +3 "$MATRIX" | while IFS='|' read -r _ game plats rest; do
    id=${game#*\`}; id=${id%%\`*}
    printf '<g id="row-%s">\n' "$id"
    rect 264 "$y" 1152 52 4 "fill=\"$PN\""
    txt 280 $((y + 22)) "$TX" 14 "$id"
    txt 280 $((y + 40)) "$T2" 12 "$(echo $plats)"
    x=520
    for s in $(echo "$rest" | tr '|' ' '); do
      rect "$x" $((y + 12)) 76 28 4 "$(status_attr "$s")"
      txt $((x + 8)) $((y + 31)) "$(status_text "$s")" 12 "$s"
      x=$((x + 88))
    done
    echo '</g>'
    y=$((y + 62))
  done
  close_frame
} > "$OUT/03-feature-matrix.svg"

{
  open_frame game-detail "NIE - Fiche jeu Victory Road" 0
  rect 264 80 1152 200 12 "fill=\"$PN\""
  rect 288 104 152 152 8 "fill=\"$RW\""
  txt 464 140 "$TX" 28 "Inazuma Eleven: Victory Road" 700
  txt 464 168 "$T2" 14 "ievr - alias ares - serie victory-road - manifeste rev 1"
  txt 464 196 "$T2" 14 "PC (Steam 2799860) - Switch - Switch 2 - PS4 - PS5"
  rect 464 216 140 36 8 "fill=\"$CY\""; txt 504 239 "$BG" 14 "Verifier" 600
  rect 616 216 160 36 8 "fill=\"none\" stroke=\"$CY\""; txt 640 239 "$CY" 14 "Mettre a jour"
  echo '<g id="verify-report">'
  rect 264 304 560 200 12 "fill=\"$PN\""
  txt 288 340 "$TX" 20 "Derniere verification" 600
  txt 288 380 "$CY" 14 "ok 1284 fichiers"
  txt 288 408 "$AM" 14 "modifies 0"
  txt 288 436 "$BR" 14 "manquants 0"
  txt 288 476 "$T2" 12 "BLAKE3 - source D:/Games/IEVR"
  echo '</g><g id="features">'
  rect 848 304 568 420 12 "fill=\"$PN\""
  txt 872 340 "$TX" 20 "Fonctionnalites" 600
  y=372
  grep '`ievr`' "$MATRIX" | cut -d'|' -f4- | tr '|' '\n' | sed 's/ //g' | grep -v '^$' | paste -d' ' - <(printf '%s\n' dump_verify asset_extract text_extract translation_patch save_edit team_builder wiki_data nie_runtime netplay mod_loader) | while read -r s f; do
    txt 872 "$y" "$T2" 14 "$f"
    rect 1280 $((y - 18)) 112 26 4 "$(status_attr "$s")"
    txt 1292 "$y" "$(status_text "$s")" 12 "$s"
    y=$((y + 34))
  done
  echo '</g><g id="ecosystem">'
  rect 264 528 560 196 12 "fill=\"$PN\""
  txt 288 564 "$TX" 20 "Ecosysteme" 600
  y=600
  for e in "data - inagle" "wiki - Azalee" "tool - aphrody-nie-save" "store - Steam 2799860"; do txt 288 "$y" "$T2" 14 "$e"; y=$((y + 28)); done
  echo '</g>'
  close_frame
} > "$OUT/04-game-detail.svg"
