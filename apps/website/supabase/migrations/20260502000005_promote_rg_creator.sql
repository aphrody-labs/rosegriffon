-- ============================================================================
-- Auto-promotion superadmin du compte créateur RG via Patreon
-- Trigger sur INSERT/UPDATE de patreon_memberships : si le patreon_user_id
-- correspond à l'URL canonique du compte officiel OU à un creator token déjà
-- stocké (is_creator=true) OU est dans la whitelist patreon_admin_owners,
-- on UPDATE profiles.role='admin'.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patreon_admin_owners (
  patreon_user_id  text PRIMARY KEY,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patreon_admin_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patreon_admin_owners_admin_rw ON public.patreon_admin_owners;
CREATE POLICY patreon_admin_owners_admin_rw
  ON public.patreon_admin_owners
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT ALL ON public.patreon_admin_owners TO service_role;
GRANT SELECT ON public.patreon_admin_owners TO authenticated;

COMMENT ON TABLE public.patreon_admin_owners IS
  'Whitelist explicite des patreon_user_id qui doivent recevoir le role admin a la connexion. Le compte rosegriffonfr est aussi detecte automatiquement via patreon_url et is_creator=true.';

CREATE OR REPLACE FUNCTION public.promote_rg_creator_to_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner       boolean := false;
  is_whitelisted boolean := false;
  is_creator_tok boolean := false;
BEGIN
  is_owner := lower(coalesce(NEW.patreon_url, '')) ~* 'patreon\.com/rosegriffonfr(/?|$)';

  IF NOT is_owner THEN
    SELECT EXISTS(
      SELECT 1 FROM public.patreon_admin_owners
      WHERE patreon_user_id = NEW.patreon_user_id
    ) INTO is_whitelisted;
  END IF;

  IF NOT is_owner AND NOT is_whitelisted THEN
    SELECT EXISTS(
      SELECT 1 FROM public.patreon_oauth_tokens
      WHERE patreon_user_id = NEW.patreon_user_id
        AND is_creator = true
    ) INTO is_creator_tok;
  END IF;

  IF NOT (is_owner OR is_whitelisted OR is_creator_tok) THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET role = 'admin',
      updated_at = now()
  WHERE id = NEW.user_id
    AND coalesce(role, '') <> 'admin';

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.promote_rg_creator_to_admin() IS
  'Trigger AFTER INSERT/UPDATE patreon_memberships : promeut profiles.role=admin pour le createur RG. Detection 3 voies (URL canonique, whitelist patreon_admin_owners, is_creator=true).';

DROP TRIGGER IF EXISTS trg_promote_rg_creator_admin
  ON public.patreon_memberships;
CREATE TRIGGER trg_promote_rg_creator_admin
  AFTER INSERT OR UPDATE OF patreon_user_id, patreon_url, user_id
  ON public.patreon_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_rg_creator_to_admin();

-- Backfill rétroactif
UPDATE public.profiles p
SET role = 'admin', updated_at = now()
FROM public.patreon_memberships m
WHERE m.user_id = p.id
  AND coalesce(p.role, '') <> 'admin'
  AND (
    lower(coalesce(m.patreon_url, '')) ~* 'patreon\.com/rosegriffonfr(/?|$)'
    OR EXISTS (
      SELECT 1 FROM public.patreon_oauth_tokens t
      WHERE t.patreon_user_id = m.patreon_user_id
        AND t.is_creator = true
    )
  );
