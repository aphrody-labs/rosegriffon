-- Migration: Add increment_article_views function
-- Date: 19 novembre 2025
-- Description: Function to increment view count for articles

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

COMMENT ON FUNCTION public.increment_article_views(UUID) IS 'Increments the view count for a specific article';
