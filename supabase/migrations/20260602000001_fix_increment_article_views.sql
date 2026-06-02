-- Migration: Fix increment_article_views (colonne views_count -> view_count)
-- Date: 2 juin 2026
-- Description: La migration 20251123000002_finalize_schema redéfinissait la
-- fonction avec la colonne inexistante `views_count` (la vraie colonne est
-- `view_count`, cf. 20251116000001). Résultat : chaque appel RPC échouait à
-- l'exécution ("column views_count does not exist"), trackArticleView()
-- retournait success:false, et les vues restaient bloquées à 0 (stats "fake").
-- On redéfinit la fonction sur la bonne colonne pour la prod déjà migrée.

CREATE OR REPLACE FUNCTION public.increment_article_views(article_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.articles
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = article_id;
END;
$$;

COMMENT ON FUNCTION public.increment_article_views(UUID) IS 'Incremente le compteur de vues (view_count) d''un article';
