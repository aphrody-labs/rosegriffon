# Vie de communauté des bots Discord

Niveaux, jetons Kizuna, collection de joueurs, tickets. Tout vit dans
`apps/bot`, sous le profil **`rg`** (le bot Rose Griffon) ; le profil `azalee`
ne charge aucun de ces modules.

> **Deux principes gouvernent tout ce document.**
> 1. **Discrétion.** Le bot ne publie rien de lui-même tant que le staff ne l'a
>    pas demandé, et les commandes répondent en privé par défaut.
> 2. **Hiérarchie stricte.** Aucun rôle à permission sensible ne peut être
>    attribué automatiquement, jamais, quelle que soit la configuration.

---

## 1. Ce qui a été repris de l'existant

| Service en place | Ce qu'on en garde | Ce qu'on corrige |
|---|---|---|
| **Noctaly** (niveaux, app `875811233616519219`) | la courbe d'activité, les paliers de rôle, l'XP des membres retrouvée | la courbe devient celle **du jeu** (`inagle_exp_table`) ; l'annonce ne part plus dans le salon du message |
| **ticketsbot.net** (tickets, depuis le 16/4/2023) | les fils privés, le salon d'historique, la numérotation (reprise à **86**) | plus aucune transcription chez un tiers ; le motif de fermeture devient **obligatoire** |

### Import de l'XP — état réel

`apps/bot/src/scripts/import-xp-tiers.ts` a récupéré **65 membres sur ~1 902**
(3,4 %). Deux modes : le premier (top 10, image `/leaderboard` du 9/8/2026,
XP arrondie à la centaine) puis `--source=historique`, qui a dépouillé
l'historique COMPLET de six salons plutôt qu'un seul instantané — fusion
`GREATEST(xp, ...)` en base, une mesure ancienne ne rétrograde jamais une
valeur plus fraîche déjà écrite.

| Salon | Couverture | Trouvé |
|---|---|---:|
| `#🤖〡bots` | intégrale, 2023→2026 | 19 (`/rank` + `/leaderboard`) |
| `#🤪〡memes-inazuma` | intégrale, 2023→2026 | 3 |
| `#🎈〡questions` | intégrale, 2023→2026 | 1 |
| `#💬〡général` | arrêtée au 11/3/2026 | 207 |
| `#📷〡médias` | arrêtée au 11/3/2026 | 45 |
| `#🎨〡vos-fanarts` | arrêtée au 17/3/2026 | 7 |

L'essentiel du volume (54 des 65 membres) ne vient PAS d'une carte `/rank` ou
`/leaderboard`, mais des embeds automatiques **« 🎉 Niveau supérieur ! »**
postés dans les salons de discussion générale — ils mentionnent l'ID Discord
en clair, donc aucune résolution par pseudo. Leur XP est le seuil OFFICIEL du
palier annoncé (table `noctaly.com/table`), un minorant réel et non la valeur
exacte de l'instant.

C'est tout ce qui était atteignable :

- l'API de Noctaly (`GET /api/v1/guilds/{id}/users/{id}/level-profile`) répond
  **401** sans clé (testé en direct), et la clé s'obtient par une connexion
  humaine sur leur tableau de bord ; la page publique du classement charge ses
  données côté client (rien dans le HTML brut) et se limite au top 100 ;
- Noctaly n'a été activé sur le serveur que le **11/3/2026** : les 3 salons
  paginés en entier jusqu'à 2023 n'ont RIEN trouvé avant cette date, ce qui a
  justifié d'arrêter les 3 autres dès qu'ils y remontaient sans rien trouver
  de plus.

**Piège trouvé et évité** : deux comptes différents partagent un pseudo
quasi identique, « IceCream » (toujours sur le serveur) et « Icecream »
(parti — `404 Unknown Member` à l'API, ce qui explique pourquoi la recherche
par pseudo ne le trouvait pas). Vérifié avant écriture pour ne pas fusionner
leurs deux XP sur un seul profil.

**Pour importer les ~1 837 autres**, il faut une clé API générée depuis le
tableau de bord Noctaly, puis relancer le script. Sans elle, ces membres
repartent de zéro — et le classement s'en trouve faussé tant qu'ils n'ont pas
reparlé.

---

## 2. Niveaux — la courbe du jeu

`apps/bot/src/lib/experience.ts` recopie les **100 paliers de
`inagle_exp_table`**, la table d'expérience d'Inazuma Eleven Victory Road. Ce
n'est pas décoratif : monter de niveau sur le Discord coûte exactement ce que ça
coûte en jeu.

| Niveau | XP cumulée | ≈ messages (20 XP / min) |
|---:|---:|---:|
| 10 | 2 422 | 121 |
| 20 | 12 291 | 615 |
| 30 | 38 310 | 1 916 |
| 50 | 195 502 | 9 776 |
| 99 | 2 878 742 | 143 938 |

Les **rangs** reprennent l'échelle de rareté du jeu, avec ses libellés français
exacts (`inagle_characters.rarity_label`) : **Normal** (1‑19), **Expérimenté**
(20‑49), **Héros** (50‑79), **BASARA** (80‑100).

### Gain

- 15 à 25 XP par message, **une fois par minute** au maximum.
- Le délai est tenu par Redis, pas par une lecture Postgres : sur un serveur
  actif, la lecture coûterait plus cher que l'écriture qu'elle évite.
- **Le contenu des messages n'est jamais lu.** L'intent `MessageContent` est
  privilégié et n'est pas demandé ; Discord livre `messageCreate` avec un
  contenu vide. On compte des messages, on ne les lit pas — et ce n'est pas une
  promesse, c'est ce que l'API nous envoie.

### Annonces — silencieuses par défaut

`niveaux.annonce` vaut **`aucune`** sur une guilde vierge. Là où elle est posée :

- `palierAnnonce` (défaut **5**) ne laisse passer que les niveaux ronds ;
- `annoncerRang` laisse passer les trois changements de rang d'une vie de membre.

Le mode `place` (annoncer dans le salon du message) existe, c'est le défaut des
bots du marché, et c'est celui qui fait couper les bots de niveaux au bout d'une
semaine sur un serveur de deux mille membres.

---

## 3. Récompenses de rôle — la surface la plus dangereuse

`/gestion niveaux recompense` attribue un rôle **tout seul, sans qu'un humain
regarde**. Quatre familles de rôles sont donc **refusées**
(`apps/bot/src/lib/hierarchie.ts`) :

1. `@everyone` ;
2. les rôles **gérés par une intégration** (bot, Patreon, boost Nitro) — Discord
   refuse de les attribuer, et l'erreur n'arrive qu'au premier membre concerné ;
3. les rôles **au niveau ou au-dessus du bot** — la hiérarchie l'interdit, et
   sans ce refus le réglage est accepté puis ne fait jamais rien ;
4. les rôles portant **une permission sensible** — `Administrator`,
   `ManageGuild`, `ManageRoles`, `ManageChannels`, `BanMembers`, `KickMembers`,
   `ManageWebhooks`, `MentionEveryone`.

Sur ce serveur, **29 rôles sur 94** tombent dans la quatrième catégorie (relevé
du 14/8/2026) : sans ce garde-fou, « niveau 30 → Modérateurs » est à un clic.

Le contrôle est fait **deux fois** : au réglage, et de nouveau à chaque
attribution (`events/experience.ts`). La seconde passe couvre les lignes
importées d'un autre bot, celles écrites en SQL, et surtout les rôles qui
gagnent des permissions **après** leur enregistrement — le cas le plus vicieux,
parce qu'il ne déclenche aucune alerte.

---

## 4. Jetons Kizuna — la monnaie du jeu

Ce n'est pas une invention : le **Jeton Kizuna** est la monnaie de la Boutique
Kizuna d'Inazuma Eleven Victory Road, texte `0xD63615BE` —
fr « Jeton Kizuna », en « Bond Token », ja « キズナトークン ».

**Trois sources, et l'absence délibérée d'une quatrième :**

| Source | Détail |
|---|---|
| `quotidien` | 25 jetons, +5 par jour consécutif, prime plafonnée à +50 au 11ᵉ jour |
| `montee-niveau` | 10 × le niveau atteint |
| `don` | de 1 à 5 000 par don, 10 000 par jour et par membre |

**Aucun gain par message.** C'était le choix évident, et c'est celui qui
transforme un salon en concours de messages d'un mot.

Chaque mouvement écrit **deux lignes dans la même transaction** : le solde et sa
ligne de journal signée. L'invariant se vérifie en une requête :

```sql
select p.discord_id, p.jetons, coalesce(sum(j.delta), 0)
  from bot_profils p
  left join bot_journal_kizuna j using (guild_id, discord_id)
 group by p.discord_id, p.jetons
having p.jetons <> coalesce(sum(j.delta), 0);
```

Zéro ligne = tout va bien.

---

## 5. Collection — recruter les joueurs du jeu

`/collection recruter` tire **un joueur au sort parmi les 6 090 nommés** des
données du jeu, à égalité de chances. Il n'y a donc aucun taux à annoncer : la
rareté observée est celle du jeu, et elle est vérifiable sur le wiki.

| Rareté | Effectif | Part | Remboursement d'un doublon |
|---|---:|---:|---:|
| Normal | 5 747 | 94,4 % | 30 |
| Expérimenté | 150 | 2,5 % | 100 |
| Héros | 122 | 2,0 % | 250 |
| BASARA | 71 | 1,2 % | 600 |

Une seule entorse : **un tirage sur dix ne peut pas rendre un joueur Normal**.
Sans elle, 56 % des membres n'auraient rien vu d'autre au bout de dix tirages.

Les **plaques de nom** (54, `inagle_nameplates`) s'achètent et servent de fond à
la carte de profil. Prix par palier de déblocage : 300 / 900 / 2 000 / 4 500.

La collection **ne donne aucun avantage** : ni XP, ni rôle, ni place au
classement. C'est la condition pour qu'une économie interne ne devienne pas une
taxe sur ceux qui n'y jouent pas.

---

## 6. Tickets — fils privés, rien chez un tiers

- Un ticket est un **fil privé** dans `📩〡demandes-tickets`, nommé
  `ticket-0086` — **le numéro, jamais le pseudo** : le nom d'un fil apparaît
  dans la liste du salon et dans le journal d'audit du serveur.
- Cinq catégories. **Signalement** est *sensible* : il ne va **qu'à la
  direction**, parce qu'un signalement peut viser un modérateur.
- **Un seul ticket ouvert par membre.** Le second renvoie vers le premier au
  lieu de refuser.
- Fermeture : **motif obligatoire**, fil **archivé et verrouillé** (jamais
  supprimé), carte de fermeture dans `📦〡ticket-history` avec les mêmes champs
  que les 84 cartes précédentes.

### Le piège qui rend un système de tickets inutile

Un fil privé n'est visible **que de ses invités et des porteurs de « Gérer les
fils »**. Mentionner un *rôle* dans un fil ne l'y fait pas entrer. Un panneau
publié sans cette permission crée des tickets que **personne au staff ne voit**,
et la panne est silencieuse.

`/gestion ticket diagnostic` le vérifie rôle par rôle, et
`/gestion ticket panneau` **refuse de publier** tant qu'un blocage subsiste.

---

## 7. Commandes

### Membres — privées par défaut, `partager: true` pour publier

| Commande | Effet |
|---|---|
| `/profil [membre] [partager]` | carte de progression (plaque du jeu en fond, joueur fétiche, rang) |
| `/classement [critere] [page] [partager]` | niveaux ou jetons Kizuna |
| `/kizuna solde\|quotidien\|donner\|journal` | solde, passage du jour, don, historique |
| `/collection voir\|recruter\|plaques\|acheter` | collection et boutique |
| `/personnaliser favori\|plaque` | ce que la carte affiche |
| `/ticket ouvrir\|fermer\|prendre\|rendre\|info\|liste` | tickets |

`/kizuna quotidien`, `/kizuna donner` et `/kizuna journal` sont **toujours**
privés. Le destinataire d'un don est prévenu **en message direct** : les deux
personnes concernées sont au courant, et personne d'autre.

### Staff — sous `/gestion`, doublement gardées

`defaultMemberPermissions = ManageGuild` retire la commande de la liste des
membres ordinaires (confort d'interface) ; `exigerDroits` lit le rôle réel dans
`profiles` (la vraie garde).

| Commande | Effet |
|---|---|
| `/gestion niveaux reglages\|recompense\|retirer\|annonce\|salon` | progression et récompenses |
| `/gestion ticket reglages\|poser\|role\|diagnostic\|panneau\|encours` | tickets |
| `/gestion sondage creer\|cloturer` | sondages natifs Discord |

---

## 8. Base de données

`apps/website/sql/migrations/20260814_bot_communaute.sql` (+ `_reglages`, `_kizuna`).

| Table | Contenu | Lisible publiquement ? |
|---|---|---|
| `bot_profils` | XP, niveau, jetons, cosmétiques équipés | **oui**, colonnes de classement seulement |
| `bot_journal_kizuna` | mouvements signés | **non** — c'est un graphe social |
| `bot_inventaire` | joueurs et plaques possédés | **non** |
| `bot_tickets` | métadonnées, **aucun message** | **non** |
| `bot_reglages_guilde` | réglages jsonb validés par zod | **non** |
| `bot_recompenses_niveau` | palier → rôle | **non** |

`dernier_gain_le` est explicitement **exclu** de la lecture publique : c'est un
horodatage de présence, donc une donnée de comportement, sans rapport avec un
classement.

> ⚠ Toute table créée en `postgres` doit finir par `alter table … owner to rg;`.
> Le bot se connecte sous le rôle `rg` : sans ça, il lève « permission denied »
> à la première écriture, longtemps après la migration et loin d'elle.

---

## 9. Menus de rôles en libre-service

`/gestion roles creer` pose un panneau dans un salon ; les membres y prennent et
y rendent leurs rôles eux-mêmes, en **menu déroulant** (25 rôles) ou en
**boutons** (5). C'est ce qui remplace les « rôles à réaction » d'un bot tiers :
une réaction ne dit pas ce qu'elle donne, se retire par mégarde, et ne sait pas
répondre.

**C'est la surface la plus exposée du bot** — n'importe qui clique, sans qu'un
humain intervienne, pendant des mois. Les rôles proposables passent donc par la
**même garde stricte** que les récompenses de niveau (§3), et ils y passent
**deux fois** : à l'ajout au menu, et à chaque clic (un rôle peut gagner des
permissions après avoir été mis au menu — ce jour-là, rien n'alerte personne).

Trois détails qui ne se devinent pas :

- un menu déroulant Discord rend la **sélection complète**, pas le changement :
  le calcul se fait par différence, sinon un rôle décoché n'est jamais retiré ;
- `minValues: 0` est ce qui rend le menu **réversible** — sans lui, Discord
  exige au moins une option et personne ne peut tout retirer ;
- le menu ne touche **que ses propres rôles** : un rôle obtenu ailleurs
  (récompense de niveau, rôle de staff) n'est jamais retiré parce qu'il n'était
  pas coché ici.

Retirer un rôle d'un menu, ou supprimer le menu, **ne dépouille personne** : les
membres qui l'avaient pris le gardent.

`bot_menus_roles` ne contient **aucune trace de qui a pris quel rôle** — Discord
tient déjà cette information, et la dupliquer chez nous en ferait un historique
de préférences (pronoms, centres d'intérêt, âge) consultable des années plus
tard.

## 10. Accueil des nouveaux membres

`/gestion accueil` règle le message de bienvenue (salon, message privé, ou
rien), son texte, la carte image, et le rôle posé à l'arrivée.

- **`aucune` par défaut**, comme les annonces de niveau. Un serveur qui reçoit
  vingt arrivées par jour n'a peut-être aucune envie de vingt messages.
- **Le rôle d'arrivée est la surface la plus large du bot** — posé à *chaque*
  arrivée, sans clic, sans niveau à atteindre. Il passe donc par la garde
  stricte du §3, et il est revérifié à chaque arrivée.
- **Aucune mention de masse possible.** Le texte est réglable par le staff ;
  `allowedMentions: { users: [membre.id] }` borne l'envoi, pour qu'un
  `@everyone` glissé dedans ne devienne pas un ping de deux mille personnes.
- **Pas de message de départ.** Il annoncerait publiquement chaque départ, y
  compris ceux qui suivent un conflit ou une sanction — le journal d'audit
  Discord porte déjà cette information, et elle appartient au staff.

`/gestion accueil apercu` montre exactement ce que verra le prochain arrivant,
sans rien publier, et signale les configurations muettes (lieu « salon » sans
salon posé).

Le texte accepte trois jetons et **rien d'autre** : `{membre}`, `{serveur}`,
`{compte}`. Un moteur de gabarit dans un champ réglable serait une surface
d'injection pour rien.

## 11. Permissions du bot — Administrator, et c'est voulu

Le bot Rose Griffon porte la permission **Administrator** sur le serveur.

C'est une **décision explicite du 14/8/2026**, pas un oubli : le bot doit savoir
faire le plus de choses possible, et il est déjà le seul outil qui écrit dans
`administration`, `gestion` et `moderation` (rôles, salons, bannissements,
exclusions, fils, webhooks). Réduire ses permissions au minimum théorique
casserait des commandes existantes à chaque ajout de fonctionnalité, pour un
gain nul — le vrai verrou d'accès n'est pas Discord, c'est `requireRgAdmin`
(`lib/rbac.ts`), qui lit le rôle réel dans `profiles` et décide seul.

**Ne pas « corriger » ce point.** Ce qui doit rester strict, c'est ce que le bot
attribue AUTOMATIQUEMENT (§3) — pas ce qu'il peut faire quand un administrateur
Rose Griffon le lui demande.

## 12. Exploitation

```bash
# après toute modification de apps/bot
sudo systemctl restart rg-bot.service azalee-bot.service
journalctl -u rg-bot.service --since "-1 min" | tail -20
```

Le démarrage doit afficher « ✓ Commandes enregistrées » et lister les guildes.
`initApplicationCommands failed` avec `Invalid Form Body` signale un dépassement
du plafond de 8 000 caractères par racine de commande : c'est ce qui a déjà fait
éclater `/administration` en trois racines (`/administration`, `/gestion`,
`/moderation`).
