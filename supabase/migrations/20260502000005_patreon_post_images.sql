-- ============================================================================
-- Archive durable des images Patreon embarquées dans les posts.
-- Les URLs <img src> du content HTML pointent vers patreonusercontent.com
-- avec des tokens signés qui expirent. On télécharge et archive.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patreon_post_images (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patreon_post_id text NOT NULL REFERENCES public.patreon_post_events(patreon_post_id) ON DELETE CASCADE,
  position        int NOT NULL DEFAULT 0,
  original_url    text NOT NULL,
  storage_path    text NOT NULL,
  content_type    text,
  size_bytes      bigint,
  sha256          text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patreon_post_id, sha256)
);

CREATE INDEX IF NOT EXISTS idx_patreon_post_images_post
  ON public.patreon_post_images(patreon_post_id, position);

ALTER TABLE public.patreon_post_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patreon_post_images_admin_read ON public.patreon_post_images;
CREATE POLICY patreon_post_images_admin_read
  ON public.patreon_post_images
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS patreon_post_images_admin_write ON public.patreon_post_images;
CREATE POLICY patreon_post_images_admin_write
  ON public.patreon_post_images
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.patreon_post_images TO authenticated;
GRANT ALL ON public.patreon_post_images TO service_role;

COMMENT ON TABLE public.patreon_post_images IS
  'Images extraites du content HTML des posts Patreon, archivees dans le bucket Storage `patreon`.';

-- Bucket privé : les contenus payants ne doivent pas etre exposes publiquement.
-- Acces lecture via service_role + admin uniquement.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patreon',
  'patreon',
  false,
  52428800, -- 50 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "patreon storage admin read" ON storage.objects;
CREATE POLICY "patreon storage admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'patreon' AND public.is_admin());

DROP POLICY IF EXISTS "patreon storage admin write" ON storage.objects;
CREATE POLICY "patreon storage admin write"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'patreon' AND public.is_admin())
  WITH CHECK (bucket_id = 'patreon' AND public.is_admin());
