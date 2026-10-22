-- `achillea.data.value` passe de varchar(255) à text.
--
-- La table est la mémoire clé/valeur de l'ancien bot Achilléa, reprise par les
-- tâches `achillea:classement-annonce`, `achillea:ranked-file` et
-- `achillea:ranked-promotions` (`packages/rg-cron/src/lib/achillea-memoire.ts`).
-- Le relevé des paliers (`rankedTierSnapshot`, un objet JSON joueur → palier)
-- dépasse 255 caractères dès une dizaine de joueurs classés : l'écriture levait
-- et aucune promotion n'était jamais annoncée. Conversion sans perte.

begin;

alter table achillea.data alter column value type text;

commit;
