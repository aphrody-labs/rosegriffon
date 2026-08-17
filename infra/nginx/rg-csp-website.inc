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
# GOOGLE TAG MANAGER
# Le conteneur chargé par src/app/layout.tsx n'était pas déclaré ici : la mesure
# d'audience aurait cessé de fonctionner à la bascule en mode bloquant, sans que
# rien ne le signale ailleurs que dans la console d'un visiteur.
#
# GOOGLE ADSENSE
# Les hôtes publicitaires sont alignés sur ceux de apps/azalee/next.config.ts, où la
# même politique tourne en mode bloquant. `frame-src` n'est donc plus `'none'` : une
# annonce s'affiche dans une iframe, et l'interdire laisse l'emplacement vide sans
# autre trace qu'un « Refused to frame » en console. Le contenu des créations est
# régi par la CSP de ces iframes, pas par celle-ci.
#
# `frame-ancestors 'none'` double X-Frame-Options: DENY de rg-securite.inc — c'est
# volontaire : X-Frame-Options est l'ancien mécanisme, frame-ancestors le remplace, et
# les deux se contredisent seulement s'ils divergent, ce qu'ils ne font pas ici.
add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.googleadservices.com https://*.doubleclick.net https://*.adtrafficquality.google https://fundingchoicesmessages.google.com https://adservice.google.com https://www.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://cdn.rosegriffon.fr https://azalee.rosegriffon.fr https://achillea.rosegriffon.fr https://placehold.co https://cdn.discordapp.com https://static-cdn.jtvnw.net https://pbs.twimg.com https://abs.twimg.com https://dxi4wb638ujep.cloudfront.net https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google https://www.google.com https://*.googleusercontent.com https://*.gstatic.com; media-src 'self' blob: data: https://cdn.rosegriffon.fr; font-src 'self' data: https://cdn.rosegriffon.fr https://*.gstatic.com; connect-src 'self' https://cdn.rosegriffon.fr https://api.rosegriffon.fr https://www.googletagmanager.com https://www.google-analytics.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google https://www.google.com https://*.gstatic.com https://fundingchoicesmessages.google.com; frame-src https://googleads.g.doubleclick.net https://*.doubleclick.net https://*.googlesyndication.com https://*.adtrafficquality.google https://www.google.com https://fundingchoicesmessages.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
