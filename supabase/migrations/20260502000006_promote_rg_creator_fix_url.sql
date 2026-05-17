-- ============================================================================
-- Fix : URL canonique RG = patreon.com/c/RoseGriffon (nouveau format Patreon
-- avec préfixe /c/ pour les "creators"). Le regex précédent ne matchait que
-- /rosegriffonfr — mise à jour pour couvrir /c/RoseGriffon, /rosegriffon et
-- /rosegriffonfr (case-insensitive, avec ou sans trailing slash).
-- ============================================================================

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
  is_owner := lower(coalesce(NEW.patreon_url, '')) ~* 'patreon\.com/(c/)?rosegriffon(fr)?(/?|$)';

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

UPDATE public.profiles p
SET role = 'admin', updated_at = now()
FROM public.patreon_memberships m
WHERE m.user_id = p.id
  AND coalesce(p.role, '') <> 'admin'
  AND (
    lower(coalesce(m.patreon_url, '')) ~* 'patreon\.com/(c/)?rosegriffon(fr)?(/?|$)'
    OR EXISTS (
      SELECT 1 FROM public.patreon_oauth_tokens t
      WHERE t.patreon_user_id = m.patreon_user_id
        AND t.is_creator = true
    )
    OR EXISTS (
      SELECT 1 FROM public.patreon_admin_owners w
      WHERE w.patreon_user_id = m.patreon_user_id
    )
  );
