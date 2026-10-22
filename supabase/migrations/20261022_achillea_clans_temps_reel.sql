-- Clans Achilléa : sous-effectif horodaté et notifications en direct.
--
-- 1. `clan.under_member_limit_since` : instant où le clan est passé sous
--    5 membres. Le legacy planifiait un job BullMQ à +24 h ; la tâche cron
--    `achillea:clans` lit désormais cet horodatage (dissolution ou rétablissement).
-- 2. Valeurs par défaut des horodatages des tables écrites par l'API unifiée
--    (MikroORM les remplissait côté application ; la DDL legacy n'en avait pas).
-- 3. Trigger `achillea_notification_temps_reel` : chaque ligne de
--    `achillea.user_notification` publie une INVALIDATION sur le topic Broadcast
--    `achillea:notifications:<id Discord>`. La charge ne contient que des
--    identifiants : le navigateur relit `GET /v1/achillea/notifications/me` avec
--    sa session pour obtenir le contenu. Un échec de diffusion n'annule jamais
--    l'écriture de la notification.

begin;

alter table achillea.clan add column if not exists under_member_limit_since timestamptz;
update achillea.clan
   set under_member_limit_since = updated_at
 where under_member_limit and under_member_limit_since is null;

do $$
declare
  t text;
begin
  foreach t in array array['clan', 'clan_member', 'clan_member_history', 'clan_invite', 'clan_application',
                           'notification', 'user_notification', 'vote_proposal'] loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'achillea' and table_name = t and column_name = 'created_at') then
      execute format('alter table achillea.%I alter column created_at set default now()', t);
    end if;
    if exists (select 1 from information_schema.columns
                where table_schema = 'achillea' and table_name = t and column_name = 'updated_at') then
      execute format('alter table achillea.%I alter column updated_at set default now()', t);
    end if;
  end loop;
end $$;

alter table achillea.clan_invite alter column last_notified_at set default now();

create or replace function achillea.notification_temps_reel() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('notificationId', new.notification_id, 'userNotificationId', new.id),
      'notification',
      'achillea:notifications:' || new.user_id,
      false);
  exception when others then
    raise warning 'achillea.notification_temps_reel: %', sqlerrm;
  end;
  return null;
end $$;

revoke all on function achillea.notification_temps_reel() from public;

drop trigger if exists achillea_notification_temps_reel on achillea.user_notification;
create trigger achillea_notification_temps_reel
  after insert on achillea.user_notification
  for each row execute function achillea.notification_temps_reel();

-- 4. Pas de planification pg_cron : `rg-core` planifie en processus (`Bun.cron`) toute
--    tâche du catalogue qui a une expression (`PLANIFICATIONS['achillea:clans']`). Une
--    seconde planification ici la déclencherait deux fois par quart d'heure.

commit;
