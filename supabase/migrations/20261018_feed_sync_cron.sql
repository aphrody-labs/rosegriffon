-- Planification de `feed:sync` (instantanés YouTube, TikTok, Instagram du Feed), toutes les 30 minutes.
-- Même mécanique que `20261017_cron_pg_net.sql` : `pg_cron` cadence, `rg_cron.appeler` appelle
-- `POST /v1/cron/feed:sync` sur l'API (hôte du disque des médias et de Chrome). Expression identique à
-- `PLANIFICATIONS['feed:sync']` (`@rosegriffon/types/cron`), en UTC.
begin;

select cron.schedule('rg:feed:sync', '4,34 * * * *', $job$select rg_cron.appeler('feed:sync')$job$);

commit;
