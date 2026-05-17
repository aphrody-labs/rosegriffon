-- ============================================================================
-- Patreon legacy / migration vers boutique Rose Griffon
-- Plan: apps/website/patreon.md §3
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper admin (réutilisable shop / patreon)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. patreon_oauth_tokens — creator + patrons reconnectés
--    Tokens chiffrés AES-256-GCM via PATREON_ENCRYPTION_KEY (cf. src/lib/patreon/encryption.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patreon_oauth_tokens (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  patreon_user_id       text NOT NULL,
  is_creator            boolean NOT NULL DEFAULT false,
  access_token_enc      text NOT NULL,
  refresh_token_enc     text NOT NULL,
  expires_at            timestamptz NOT NULL,
  scope                 text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, patreon_user_id)
);

CREATE INDEX IF NOT EXISTS idx_patreon_tokens_user
  ON public.patreon_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_patreon_tokens_patreon_user
  ON public.patreon_oauth_tokens(patreon_user_id);
CREATE INDEX IF NOT EXISTS idx_patreon_tokens_creator
  ON public.patreon_oauth_tokens(is_creator) WHERE is_creator = true;

-- ---------------------------------------------------------------------------
-- 2. patreon_legacy_members — snapshot supporters Patreon (export J-0)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patreon_legacy_members (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patreon_member_id           text UNIQUE NOT NULL,
  patreon_user_id             text NOT NULL,
  email                       text,
  full_name                   text,
  patron_status               text NOT NULL,
  last_charge_date            timestamptz,
  last_charge_status          text,
  currently_entitled_cents    bigint,
  lifetime_support_cents      bigint,
  pledge_start                timestamptz,
  pledge_cadence              int,
  tier_titles                 text[],
  tier_ids                    text[],
  discord_user_id             text,
  shipping_address            jsonb,
  raw_payload                 jsonb NOT NULL,
  imported_at                 timestamptz NOT NULL DEFAULT now(),
  resolved_user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at                 timestamptz,
  resolution_method           text,
  rg_subscription_status      text NOT NULL DEFAULT 'pending',
  rg_subscription_ref         text,
  reactivated_at              timestamptz,
  notified_at                 timestamptz,
  notification_count          int NOT NULL DEFAULT 0,
  CONSTRAINT patreon_legacy_status_chk CHECK (
    rg_subscription_status IN ('pending', 'reactivated', 'churned', 'grandfathered')
  ),
  CONSTRAINT patreon_legacy_resolution_chk CHECK (
    resolution_method IS NULL
    OR resolution_method IN ('email', 'discord_id', 'manual')
  )
);

CREATE INDEX IF NOT EXISTS idx_patreon_legacy_email
  ON public.patreon_legacy_members(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patreon_legacy_discord
  ON public.patreon_legacy_members(discord_user_id) WHERE discord_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patreon_legacy_status
  ON public.patreon_legacy_members(rg_subscription_status);
CREATE INDEX IF NOT EXISTS idx_patreon_legacy_resolved
  ON public.patreon_legacy_members(resolved_user_id) WHERE resolved_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. patreon_webhook_events — idempotence pendant phase parallèle
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patreon_webhook_events (
  id              text PRIMARY KEY,
  trigger         text NOT NULL,
  payload         jsonb NOT NULL,
  signature_valid boolean NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz,
  status          text NOT NULL DEFAULT 'pending',
  error           text,
  CONSTRAINT patreon_webhook_status_chk CHECK (
    status IN ('pending', 'done', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_patreon_webhook_status
  ON public.patreon_webhook_events(status) WHERE status <> 'done';
CREATE INDEX IF NOT EXISTS idx_patreon_webhook_received
  ON public.patreon_webhook_events(received_at DESC);

-- ---------------------------------------------------------------------------
-- 4. patreon_legacy_tiers — snapshot tiers + mapping vers Stripe
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patreon_legacy_tiers (
  patreon_tier_id   text PRIMARY KEY,
  title             text NOT NULL,
  amount_cents      bigint NOT NULL,
  description       text,
  discord_role_ids  text[],
  patron_count      int,
  published         boolean,
  rg_plan_name      text,
  rg_price_id       text,
  imported_at       timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 5. updated_at trigger générique
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patreon_oauth_tokens_updated_at ON public.patreon_oauth_tokens;
CREATE TRIGGER trg_patreon_oauth_tokens_updated_at
  BEFORE UPDATE ON public.patreon_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_patreon_legacy_tiers_updated_at ON public.patreon_legacy_tiers;
CREATE TRIGGER trg_patreon_legacy_tiers_updated_at
  BEFORE UPDATE ON public.patreon_legacy_tiers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RLS — admin only sauf tokens owner et legacy resolved_user_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.patreon_oauth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patreon_tokens_owner ON public.patreon_oauth_tokens;
CREATE POLICY patreon_tokens_owner
  ON public.patreon_oauth_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

ALTER TABLE public.patreon_legacy_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patreon_legacy_read ON public.patreon_legacy_members;
CREATE POLICY patreon_legacy_read
  ON public.patreon_legacy_members
  FOR SELECT TO authenticated
  USING (public.is_admin() OR resolved_user_id = auth.uid());

DROP POLICY IF EXISTS patreon_legacy_write ON public.patreon_legacy_members;
CREATE POLICY patreon_legacy_write
  ON public.patreon_legacy_members
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.patreon_webhook_events ENABLE ROW LEVEL SECURITY;
-- service role only — pas de policy authenticated.

ALTER TABLE public.patreon_legacy_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patreon_tiers_read ON public.patreon_legacy_tiers;
CREATE POLICY patreon_tiers_read
  ON public.patreon_legacy_tiers
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS patreon_tiers_write ON public.patreon_legacy_tiers;
CREATE POLICY patreon_tiers_write
  ON public.patreon_legacy_tiers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. Grants Supabase Cloud (cf. CLAUDE.md piège GRANTs post-migration)
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.patreon_legacy_tiers TO anon, authenticated;
GRANT SELECT ON public.patreon_legacy_members TO authenticated;
GRANT ALL ON public.patreon_oauth_tokens TO authenticated;
GRANT ALL ON public.patreon_webhook_events TO service_role;

COMMENT ON TABLE public.patreon_oauth_tokens IS
  'OAuth tokens Patreon chiffrés AES-256-GCM. is_creator=true pour le compte RG creator.';
COMMENT ON TABLE public.patreon_legacy_members IS
  'Snapshot des supporters Patreon historiques. resolved_user_id rempli après match email/discord/manual.';
COMMENT ON TABLE public.patreon_webhook_events IS
  'Webhooks Patreon HMAC-MD5. id = X-Patreon-Event-Id pour idempotence.';
COMMENT ON TABLE public.patreon_legacy_tiers IS
  'Tiers Patreon snapshot + mapping vers les Stripe price IDs RG.';
