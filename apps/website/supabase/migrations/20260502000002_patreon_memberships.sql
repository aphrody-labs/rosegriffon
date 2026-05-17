-- ============================================================================
-- Patreon memberships actifs — snapshot live post-OAuth callback
-- Distinct de patreon_legacy_members (snapshot statique J-0 pour migration).
-- Cette table reflète l'état Patreon courant pour chaque user lié, mise à jour
-- à chaque callback OAuth + à chaque webhook (members:create/update/delete).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patreon_memberships (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patreon_user_id             text NOT NULL,
  patreon_member_id           text,
  campaign_id                 text,

  -- Identité Patreon (issue de /identity)
  patreon_email               text,
  patreon_full_name           text,
  patreon_thumb_url           text,
  patreon_url                 text,
  discord_user_id             text,

  -- Membership (issue de included[type=member])
  patron_status               text,
  last_charge_date            timestamptz,
  last_charge_status          text,
  currently_entitled_cents    bigint,
  lifetime_support_cents      bigint,
  pledge_start                timestamptz,
  pledge_cadence              int,
  will_pay_amount_cents       bigint,

  -- Tiers entitled (issue de relationships.currently_entitled_tiers)
  tier_ids                    text[] NOT NULL DEFAULT '{}',
  tier_titles                 text[] NOT NULL DEFAULT '{}',
  tier_amounts_cents          bigint[] NOT NULL DEFAULT '{}',
  discord_role_ids            text[] NOT NULL DEFAULT '{}',

  -- Brut pour debug / re-parse futur
  raw_identity                jsonb,

  -- Métadonnées
  scope                       text,
  fetched_at                  timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, patreon_user_id),

  CONSTRAINT patreon_membership_status_chk CHECK (
    patron_status IS NULL
    OR patron_status IN ('active_patron', 'declined_patron', 'former_patron')
  )
);

CREATE INDEX IF NOT EXISTS idx_patreon_memberships_user
  ON public.patreon_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_patreon_memberships_patreon_user
  ON public.patreon_memberships(patreon_user_id);
CREATE INDEX IF NOT EXISTS idx_patreon_memberships_member
  ON public.patreon_memberships(patreon_member_id) WHERE patreon_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patreon_memberships_status
  ON public.patreon_memberships(patron_status) WHERE patron_status = 'active_patron';
CREATE INDEX IF NOT EXISTS idx_patreon_memberships_discord
  ON public.patreon_memberships(discord_user_id) WHERE discord_user_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_patreon_memberships_updated_at ON public.patreon_memberships;
CREATE TRIGGER trg_patreon_memberships_updated_at
  BEFORE UPDATE ON public.patreon_memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.patreon_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patreon_memberships_owner_read ON public.patreon_memberships;
CREATE POLICY patreon_memberships_owner_read
  ON public.patreon_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS patreon_memberships_admin_write ON public.patreon_memberships;
CREATE POLICY patreon_memberships_admin_write
  ON public.patreon_memberships
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.patreon_memberships TO authenticated;
GRANT ALL ON public.patreon_memberships TO service_role;

COMMENT ON TABLE public.patreon_memberships IS
  'État Patreon live par user_id. Mis à jour à chaque OAuth callback + webhooks members:*. Distinct de patreon_legacy_members (snapshot J-0).';

-- ---------------------------------------------------------------------------
-- Réduction 20% pour patrons actifs sur la boutique Stripe RG
-- Coexistence Patreon ↔ Stripe : un user `active_patron` chez RG bénéficie
-- automatiquement de 20% sur la boutique. La fonction est SECURITY DEFINER
-- pour pouvoir être appelée depuis n'importe quel contexte (RLS, edge fn,
-- webhook Stripe, server action) sans avoir à dupliquer la logique.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_patron(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patreon_memberships
    WHERE user_id = uid
      AND patron_status = 'active_patron'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_patron(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_active_patron(uuid) IS
  'true si user_id a un membership Patreon actif. Source de vérité pour la réduction 20% boutique Stripe.';
