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
