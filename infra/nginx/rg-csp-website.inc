# Politique de sécurité du contenu de rosegriffon.fr — en mode RAPPORT SEUL.
#
# POURQUOI REPORT-ONLY
# Une CSP posée d'emblée en mode bloquant casse la page au premier domaine oublié, et
# personne ne le voit avant le visiteur. Celle-ci est dérivée des sources réellement
# déclarées par l'application — `images.remotePatterns` de apps/website/next.config.ts
# pour img-src, les deux `<script>` en ligne de src/app/layout.tsx (pré-application du
# thème et JSON-LD) pour 'unsafe-inline'. Elle est donc plausible, pas vérifiée : tant
# qu'aucune session de navigation n'a confirmé zéro violation, elle reste en
# `Content-Security-Policy-Report-Only`, qui rapporte dans la console sans jamais
# bloquer une ressource.
#
# BASCULE EN MODE BLOQUANT
# Ouvrir rosegriffon.fr, la boutique et une fiche produit dans un navigateur, console
# ouverte ; si aucune ligne « [Report Only] Refused to load… » n'apparaît, renommer
# l'en-tête ci-dessous en `Content-Security-Policy`. Le pendant bloquant tourne déjà sur
# azalee.rosegriffon.fr, où l'application l'émet elle-même.
#
# `frame-ancestors 'none'` double X-Frame-Options: DENY de rg-securite.inc — c'est
# volontaire : X-Frame-Options est l'ancien mécanisme, frame-ancestors le remplace, et
# les deux se contredisent seulement s'ils divergent, ce qu'ils ne font pas ici.
add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://cdn.rosegriffon.fr https://azalee.rosegriffon.fr https://achillea.rosegriffon.fr https://placehold.co https://cdn.discordapp.com https://static-cdn.jtvnw.net https://pbs.twimg.com https://abs.twimg.com https://dxi4wb638ujep.cloudfront.net; media-src 'self' blob: data: https://cdn.rosegriffon.fr; font-src 'self' data: https://cdn.rosegriffon.fr; connect-src 'self' https://cdn.rosegriffon.fr https://api.rosegriffon.fr; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
