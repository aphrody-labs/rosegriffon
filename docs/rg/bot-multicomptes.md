# Rapprochement de comptes — `/moderation multicomptes`

Reconnaître les comptes Discord qui pourraient appartenir à une même personne :
un membre banni qui revient sous un autre pseudo, un compte d'appoint qui vote
deux fois à un sondage, une vague de comptes jetables arrivée en une minute.

**Ce dispositif ne prouve rien.** Discord ne donne ni adresse IP ni empreinte
d'appareil : tout repose sur des ressemblances observables, et la conclusion
appartient au staff. Aucune commande ne sanctionne, ne recommande de sanction,
ni ne publie quoi que ce soit — les quatre sous-commandes répondent en éphémère.

## Les commandes

| Commande | Ce qu'elle fait |
| --- | --- |
| `/moderation multicomptes membre <membre> [niveau]` | Les comptes qui ressemblent à un membre, avec le détail des indices. |
| `/moderation multicomptes balayage [niveau] [jours]` | Tout le serveur, du plus fort au plus faible, paginé. |
| `/moderation multicomptes verdict <a> <b> <décision> [motif]` | Confirme une paire, l'écarte, ou annule un verdict posé. |
| `/moderation multicomptes tranchees` | Ce que le staff a déjà décidé. |

Toutes exigent le rôle `admin` ou `staff` dans `profiles` (garde
`requireRgAdmin`, `lib/rbac.ts`), et le serveur Rose Griffon : `discord_members`
n'a pas de colonne `guild_id`, elle ne décrit que cette communauté.

## Les indices

| Indice | Poids | Ce qu'il constate |
| --- | --- | --- |
| 🔗 Même compte du site | 70 | Deux comptes Discord rattachés au même profil, courriel, Steam ou Patreon. **Ce n'est pas une ressemblance** : la personne l'a établi elle-même en se connectant. |
| 🖼️ Même avatar | 34 | Même condensat d'image — donc le même fichier téléversé. Dégressif : partagé par huit comptes, il ne vaut presque plus rien. |
| 🏷️ Même surnom | 24 | Même surnom posé sur le serveur. |
| 🔁 Relève | 24 | Un compte part, l'autre arrive dans la foulée. Le motif du contournement de sanction. |
| 🔤 Même racine de pseudo | 22 | `markevans` et `markevans_alt2` tombent sur la même racine. Dégressif aussi. |
| 🔤 Pseudos voisins | 18 | Ressemblance entre toutes les identités (pseudo, nom d'affichage, surnom) des deux comptes. |
| 🕰️ Activités alternées | 18 | Jamais actifs dans le même créneau de dix minutes, alors qu'ils écrivent dans les mêmes salons. |
| 🥚 Créations rapprochées | 18 | Comptes créés à quelques heures d'intervalle (date lue dans le flocon). |
| 🚪 Arrivées rapprochées | 16 | Arrivés sur le serveur à quelques minutes d'intervalle. |
| 🌱 Compte neuf | 8 | Le plus récent a rejoint moins d'une semaine après sa création. Ne compte qu'en présence d'un autre indice. |
| 👥 Activités simultanées | −8 | Souvent actifs en même temps. **Ne disculpe pas** — on tient très bien deux comptes sur deux appareils. |

Le score est la somme des poids, et le niveau en découle :

| Niveau | Seuil | Lecture |
| --- | --- | --- |
| 🟥 Rattachement établi | 65 | Ou dès qu'une liaison déclarée existe. |
| 🟧 Faisceau d'indices | 42 | Plusieurs constatations indépendantes concordent. |
| 🟨 À examiner | 24 | La valeur par défaut du balayage. |
| ⬜ Coïncidence | 12 | Deux comptes créés le même jour, rien de plus. |

**Aucun indice observable n'atteint seul le seuil de « faisceau ».** C'est le
calibrage, et `lib/multicomptes.test.ts` le vérifie.

## Ce qui a été refusé

- **L'adresse postale.** `profiles` porte les adresses de livraison des
  acheteurs de la boutique, et deux commandes expédiées à la même adresse
  seraient un indice puissant. Il est écarté : son faux positif le plus probable,
  ce sont deux frères et sœurs — exactement le double compte *légitime* que
  l'outil doit épargner — et l'afficher révélerait au staff que deux membres
  vivent sous le même toit.
- **Les avatars par défaut.** Discord n'en sert que cinq pour toute la
  plateforme ; 122 membres se les partagent, dont 25 sur la même image. Les
  compter produirait à lui seul plus de fausses paires que tout le reste n'en
  produit de vraies.
- **L'action automatique.** Rien ne bannit, rien n'alerte, rien ne se publie.
  « Trois comptes rapprochés ⇒ exclusion » est une règle de communauté, pas une
  règle de code.

## Les verdicts

Le rapprochement ne stocke aucun score : il recalcule tout à chaque appel, parce
qu'un score figé se périme à la première réinscription. Ce qui persiste, c'est la
décision humaine, dans `bot_multicomptes_verdicts` (migration
`apps/website/sql/migrations/20260829_bot_multicomptes.sql`).

- `confirme` — une note, rien de plus : elle ne bannit personne.
- `ecarte` — la paire cesse de remonter dans `balayage`. Elle reste visible sur
  la fiche de chaque membre concerné : masquer au staff sa propre décision serait
  pire que de la répéter.

Sans ces verdicts, chaque balayage remonterait les mêmes faux positifs, et un
outil qui redemande sans cesse la même chose finit par n'être plus lu.

## Fonctionnement

```
discord_members ─┐
discord_messages ├─→ services/multicomptes.ts ─→ lib/multicomptes.ts ─→ commande
account, profiles┘   (SQL, cache 5 min)          (module pur, testé)
```

- **`lib/multicomptes.ts`** — module pur : normalisation des pseudos (accents,
  « leet », alphabets décoratifs, suffixes de double compte), distance de
  Levenshtein plafonnée, poids, seuils, regroupement.
- **`services/multicomptes.ts`** — les requêtes, le cliché en mémoire, les
  verdicts. Les liaisons sont des empreintes opaques (`courriel:<md5>`), le
  condensat étant calculé par Postgres : aucune adresse ne transite par le bot.
- **`commands/administration/multicomptes.ts`** — les quatre sous-commandes.

Le balayage ne compare pas tout avec tout : 2 098 membres feraient 2,2 millions
de paires. Les candidats sont fabriqués par regroupement (même avatar, même
racine, même préfixe, même jour de création ou d'arrivée, même liaison), et une
grappe trop large est ignorée — un préfixe de quatre lettres partagé par treize
comptes ne dit rien. **Mesuré sur la production du 29/8/2026 : 4 821 paires
examinées, 450 ms à froid, 207 ms sur le cliché.**

## Limites connues

- `discord_messages` ne couvre que les salons suivis et 254 auteurs sur 2 098 :
  l'indice temporel ne joue que pour les membres réguliers, et le module exige un
  minimum d'activité **des deux côtés** avant d'en conclure quoi que ce soit.
- Le rattachement déclaré ne couvre que les comptes liés au site — 7 par Better
  Auth, ~1 836 par `profiles.discord_id`.
- `discord_members` est alimentée par `rg-cron` : un membre arrivé dans la
  demi-heure peut ne pas encore y figurer.
- Il n'existe **pas** d'alerte à l'arrivée. Elle demanderait un salon de veille
  dans les réglages de communauté, et la règle du dépôt veut qu'aucun service ne
  publie sans activation explicite. `balayage jours:7` couvre le même besoin en
  mode consultation.
