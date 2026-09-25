# Achilléa — journal de vérification réelle du 25 septembre 2026

Release observée sur `/srv/rg/current` : `b032406b2a92a8adb5e6d43cb952bd897831dc3e`.
Les cinq services `rg-website`, `rg-api`, `rg-bot`, `rg-achillea-bot` et `rg-cron`
étaient actifs ; les probes HTTPS du site et de l'API des tournois ont répondu 200.
Navigateur Chrome connecté : le menu affichait le profil public `aphrody_code`.
Aucun cookie, jeton ni identifiant privé n'est conservé ici.

| Page ou API | Action en session réelle | Observation | État |
| --- | --- | --- | --- |
| `/achillea/tournaments` | Ouvrir la page | 9 tournois visibles ; Summer Kama Club marqué « Terminé », conforme à `internal_state` | Réussi |
| `/achillea/tournaments` | Filtrer « Terminés », chercher `Ilion`, puis « Inscriptions ouvertes » | 9 terminés ; recherche ramenée aux 6 coupes d'Ilion ; aucun tournoi ouvert, état vide explicite | Réussi |
| `/achillea/tournaments/23` | Ouvrir « Arbre du tournoi » | 5 tours et finale avec scores visibles ; l'API détail expose désormais les stages réels | Réussi en lecture |
| `/achillea/tournaments/circuit/ranking` | Ouvrir Joueurs, Clans, Tournois | 95 joueurs, 18 clans, 5 tournois ; podiums et liens visibles | Réussi en lecture |
| `/achillea/ranked/leaderboard` | Ouvrir la liste, filtrer le palier Bronze | 12 joueurs en solo, puis 1 joueur Bronze ; total et ligne cohérents | Réussi |
| `/achillea/ranked/history?player=980132803272376370` | Suivre le lien d'historique depuis le classement | 3 matchs publics et bilan affichés | Réussi en lecture |
| `/achillea/ranked/history` | Ouvrir avec la session et choisir « 7 jours » | 7 matchs personnels sur toute la période ; 0 sur 7 jours, état vide explicite | Réussi |
| `/achillea/ranked` | Ouvrir le hub connecté | Profil classé indisponible ; `GET /api/ranked/me?mode=2` répond 500 | **Échec** : insertion `user_elo` refusée par RLS |
| `GET /api/tournaments` | Appel public de production | 9 éléments, `meta.total=9`, Summer Kama Club `Finished` | Réussi |
| `GET /api/tournaments/circuit/ranking` | Appel public de production | 95 joueurs, 18 clans, 5 tournois | Réussi |

La cause du 500 du profil est le `GET /ranked/me` qui écrit une ligne
`user_elo` à la première lecture sous un rôle soumis à RLS. Ce défaut est en
cours de correction ; aucune validation de la correction n'est revendiquée.

Ce journal couvre seulement les actions listées. La matrice
[`achillea-qa-matrix.md`](achillea-qa-matrix.md) et l'inventaire
[`achillea-api-route-inventory.csv`](achillea-api-route-inventory.csv) gardent
les autres pages, contrôles, rôles et routes au statut « à tester ».
Les écritures de scores, distributions d'AP et actions d'administration sur
les tournois historiques n'ont pas été utilisées comme tests.

## Nouvelle release `da1e899` (25 septembre 2026)

Le pointeur `/srv/rg/current` cible `da1e8991484bee7f45302c0f76824dba605b0966`.
Les cinq services RG sont actifs. Dans la même session Chrome connectée,
`/achillea/ranked` affiche désormais le profil public `aphrody_code`, le palier
Fer, les statistiques et les commandes de défi et recherche. L'échec RLS
observé ci-dessus est donc corrigé sur cette lecture authentifiée.

Le miroir Discord partagé est déployé avec la même valeur absolue de
`RG_DISCORD_SYNC_SQLITE_PATH` dans `rg-bot`, `rg-achillea-bot` et `rg-cron`.
Sa présence dans la configuration ne prouve pas encore que les guildes ont été
collectées ; vérifier les lignes de `rg_discord_sync_runs` par profil après
une exécution réelle de synchronisation. Le bot Achilléa courant a signalé
58 guildes rejointes, mais ses intents privilégiés `GuildMembers`,
`GuildPresences` et `MessageContent` sont refusés par Discord : l'inventaire
des membres de ce profil ne peut pas être complet dans cet état.

## Vérification Discord et administration

La release `b29edd8` a activé le miroir et un lancement ponctuel du jeton
Achilléa legacy a terminé avec `guilds=4 succeeded=4 failed=0`. La base SQLite
partagée contenait ensuite 58 guildes pour `current`, 4 pour `legacy` et 2 pour
`rg`; le cache Redis portait 64 résumés. Les inventaires de membres Achilléa
sont incomplets car ces sessions ne disposent pas de l'intent membres.

Depuis `/admin/cron` en session administrateur réelle, le bouton de collecte
Discord a d'abord révélé `CRON_SECRET` absent du démon. Son provisionnement a
été corrigé, puis le même bouton a bien déclenché la tâche. La projection de
la guilde Achilléa a réussi avec 3 261 membres et 105 rôles sur la release
`381b639`. La guilde RG a été limitée par Discord (`opcode 8`) lors de cet
essai ; son miroir reste présent, mais la projection métier n'est pas déclarée
réussie. Les échecs ont été consignés sans réconciliation destructive.

`/admin/stats` a été ouvert en session admin : l'audience affichait zéro
requête malgré des accès au site. Le journal `/var/log/nginx/rg-stats.log`
était vide et la configuration Nginx active ne définissait pas `rg_stats`.
Une correction infra est préparée, mais elle n'est pas validée dans cette
release ; l'audience ne doit pas être présentée comme complète.

## Validation de la release `72632af`

La dernière collecte RG a terminé sans erreur : Rose Griffon 1 854/1 854
membres et 92 rôles ; Achilléa 3 261/3 261 membres et 105 rôles. Dans le
miroir partagé, le profil `rg` porte 2 guildes et 5 115 membres avec les deux
inventaires complets. `current` porte 58 guildes et `legacy` 4, leurs membres
restant incomplets faute d'intents privilégiés. Redis portait 64 résumés.

La release `72632af` est active avec ses cinq services. `nginx -t` réussit,
`rg_stats` est chargé et le journal a commencé à recevoir des lignes. En
session admin, `/admin/stats` affichait 62 requêtes analysées et 6 domaines
actifs après redémarrage ; l'onglet Achilléa montrait son trafic local, sans
additionner le cache planifié. `/admin/settings` affichait trois champs RG et
quatre champs Achilléa, tous issus du contrat public, et `/admin/achillea`
affichait le rapprochement des comptes. `GET /api/admin/config/public` répond
401 sans session ; son accès authentifié direct n'a pas été vérifié car le
navigateur connecté bloque la navigation brute vers cette API.
