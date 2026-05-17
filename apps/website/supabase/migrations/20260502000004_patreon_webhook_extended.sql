-- ============================================================================
-- Webhook Patreon : audit posts:* + heartbeat / health du webhook
-- Patreon désactive un webhook après plusieurs échecs consécutifs (status non-2xx).
-- On stocke un heartbeat single-row pour pouvoir détecter rapidement un endpoint
-- silencieux + reset/unpause via PATCH /webhooks/{id} côté admin.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patreon_post_events (
  patreon_post_id   text PRIMARY KEY,
  campaign_id       text,
  trigger           text NOT NULL,
  title             text,
  content_excerpt   text,
  url               text,
  published_at      timestamptz,
  is_paid           boolean,
  is_public         boolean,
  embed_url         text,
  embed_data        jsonb,
  raw_payload       jsonb NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patreon_post_events_published
  ON public.patreon_post_events(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_patreon_post_events_campaign
  ON public.patreon_post_events(campaign_id);

DROP TRIGGER IF EXISTS trg_patreon_post_events_updated_at ON public.patreon_post_events;
CREATE TRIGGER trg_patreon_post_events_updated_at
  BEFORE UPDATE ON public.patreon_post_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.patreon_post_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patreon_post_events_read ON public.patreon_post_events;
CREATE POLICY patreon_post_events_read
  ON public.patreon_post_events
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS patreon_post_events_admin_write ON public.patreon_post_events;
CREATE POLICY patreon_post_events_admin_write
  ON public.patreon_post_events
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.patreon_post_events TO authenticated;
GRANT ALL ON public.patreon_post_events TO service_role;

COMMENT ON TABLE public.patreon_post_events IS
  'Audit trail des posts Patreon (triggers posts:publish/update/delete). Sert au digest hebdo + monitoring activite createur.';

-- Heartbeat / état du webhook Patreon (single-row pattern)
CREATE TABLE IF NOT EXISTS public.patreon_webhook_state (
  id                              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  patreon_webhook_id              text,
  uri                             text NOT NULL DEFAULT 'https://rosegriffon.fr/api/auth/patreon/webhook',
  triggers                        text[] NOT NULL DEFAULT '{}',
  paused                          boolean DEFAULT false,
  num_consecutive_times_failed    int DEFAULT 0,
  last_attempted_at               timestamptz,
  last_received_at                timestamptz,
  last_event_id                   text,
  last_trigger                    text,
  total_received                  bigint NOT NULL DEFAULT 0,
  total_failed                    bigint NOT NULL DEFAULT 0,
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.patreon_webhook_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_patreon_webhook_state_updated_at ON public.patreon_webhook_state;
CREATE TRIGGER trg_patreon_webhook_state_updated_at
  BEFORE UPDATE ON public.patreon_webhook_state
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.patreon_webhook_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patreon_webhook_state_admin_read ON public.patreon_webhook_state;
CREATE POLICY patreon_webhook_state_admin_read
  ON public.patreon_webhook_state
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS patreon_webhook_state_admin_write ON public.patreon_webhook_state;
CREATE POLICY patreon_webhook_state_admin_write
  ON public.patreon_webhook_state
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.patreon_webhook_state TO authenticated;
GRANT ALL ON public.patreon_webhook_state TO service_role;

COMMENT ON TABLE public.patreon_webhook_state IS
  'Heartbeat + statistiques du webhook Patreon. Single-row (id=1). last_received_at update a chaque POST signe valide pour monitoring.';
