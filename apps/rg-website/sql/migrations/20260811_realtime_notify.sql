-- Remplacement du Realtime Supabase par LISTEN/NOTIFY Postgres.
--
-- Le service rg-realtime (apps/realtime/server.ts) tient une connexion
-- `LISTEN rg_realtime` et rediffuse chaque événement en SSE aux navigateurs.
-- Seules les tables réellement écoutées par le site portent le trigger.
--
-- Application : psql -d rg -f apps/website/sql/migrations/20260811_realtime_notify.sql

CREATE OR REPLACE FUNCTION public.rg_realtime_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  payload   jsonb;
  row_new   jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  row_old   jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
BEGIN
  payload := jsonb_build_object(
    'schema',    TG_TABLE_SCHEMA,
    'table',     TG_TABLE_NAME,
    'eventType', TG_OP,
    'new',       row_new,
    'old',       row_old
  );

  -- pg_notify plafonne à 8000 octets : au-delà on n'envoie que les identifiants
  -- et on marque l'événement tronqué, à charge du client de recharger.
  IF octet_length(payload::text) > 7000 THEN
    payload := jsonb_build_object(
      'schema',    TG_TABLE_SCHEMA,
      'table',     TG_TABLE_NAME,
      'eventType', TG_OP,
      'truncated', true,
      'new',       CASE WHEN row_new IS NULL THEN NULL ELSE jsonb_build_object('id', row_new -> 'id') END,
      'old',       CASE WHEN row_old IS NULL THEN NULL ELSE jsonb_build_object('id', row_old -> 'id') END
    );
  END IF;

  PERFORM pg_notify('rg_realtime', payload::text);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS rg_realtime_comments ON public.comments;
CREATE TRIGGER rg_realtime_comments
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.rg_realtime_notify();

DROP TRIGGER IF EXISTS rg_realtime_settings ON public.settings;
CREATE TRIGGER rg_realtime_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.rg_realtime_notify();

DROP TRIGGER IF EXISTS rg_realtime_profiles ON public.profiles;
CREATE TRIGGER rg_realtime_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.rg_realtime_notify();
