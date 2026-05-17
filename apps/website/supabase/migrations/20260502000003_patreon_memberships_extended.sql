-- ============================================================================
-- Patreon memberships : champs manquants vs API Patreon v2 officielle
-- Référence : https://docs.patreon.com/#member-attributes
-- ============================================================================

ALTER TABLE public.patreon_memberships
  ADD COLUMN IF NOT EXISTS is_free_trial      boolean,
  ADD COLUMN IF NOT EXISTS is_gifted          boolean,
  ADD COLUMN IF NOT EXISTS next_charge_date   timestamptz,
  ADD COLUMN IF NOT EXISTS member_email       text,
  ADD COLUMN IF NOT EXISTS note               text,
  ADD COLUMN IF NOT EXISTS address            jsonb,
  ADD COLUMN IF NOT EXISTS tier_requires_shipping boolean[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_patreon_memberships_next_charge
  ON public.patreon_memberships(next_charge_date)
  WHERE next_charge_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patreon_memberships_free_trial
  ON public.patreon_memberships(is_free_trial)
  WHERE is_free_trial = true;

COMMENT ON COLUMN public.patreon_memberships.last_charge_status IS
  'Patreon last_charge_status: Paid|Declined|Deleted|Pending|Refunded|Fraud|Refunded by Patreon|Other|Partially Refunded|Free Trial|Refund Pending|Refund Declined|null';

COMMENT ON COLUMN public.patreon_memberships.address IS
  'Adresse de livraison (jsonb) issue de l include=address sur /identity. Champs: line_1, line_2, city, state, country, postal_code, addressee, phone_number.';

COMMENT ON COLUMN public.patreon_memberships.note IS
  'Notes du creator sur ce membre (visible admin uniquement).';

COMMENT ON COLUMN public.patreon_memberships.member_email IS
  'Email du member (peut differer de patreon_email = user.email). Requires campaigns.members[email] scope.';

CREATE OR REPLACE FUNCTION public.get_my_patreon_status()
RETURNS TABLE (
  is_active            boolean,
  status               text,
  tier_titles          text[],
  currently_entitled_cents bigint,
  next_charge_date     timestamptz,
  is_free_trial        boolean,
  is_gifted            boolean,
  discount_percent     int
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    (m.patron_status = 'active_patron') AS is_active,
    m.patron_status                      AS status,
    m.tier_titles,
    m.currently_entitled_cents,
    m.next_charge_date,
    m.is_free_trial,
    m.is_gifted,
    CASE WHEN m.patron_status = 'active_patron' THEN 20 ELSE 0 END AS discount_percent
  FROM public.patreon_memberships m
  WHERE m.user_id = auth.uid()
  ORDER BY m.currently_entitled_cents DESC NULLS LAST
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_patreon_status() TO authenticated;

COMMENT ON FUNCTION public.get_my_patreon_status() IS
  'Renvoie l etat Patreon condense pour l user courant (auth.uid). Utilise par le front pour afficher prix barre, badge tier, prochaine charge.';
