-- ============================================================================
-- MIGRATION FINALE - Harmonisation du schéma et des permissions
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table admin_logs (Manquante dans les migrations précédentes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB
);

-- Enable RLS
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Authenticated users can insert admin logs" ON public.admin_logs;
CREATE POLICY "Authenticated users can insert admin logs"
ON public.admin_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view admin logs" ON public.admin_logs;
CREATE POLICY "Admins can view admin logs"
ON public.admin_logs FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- ---------------------------------------------------------------------------
-- 2. Mise à jour de la table team_members (Colonnes manquantes)
-- ---------------------------------------------------------------------------
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS team_name TEXT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS member_link TEXT;

-- ---------------------------------------------------------------------------
-- 3. Storage Bucket: assets (Pour le Media Manager)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Policies pour assets
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'assets' );

DROP POLICY IF EXISTS "Admin Upload Access" ON storage.objects;
CREATE POLICY "Admin Upload Access"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'assets' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admin Update/Delete Access" ON storage.objects;
CREATE POLICY "Admin Update/Delete Access"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'assets' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

DROP POLICY IF EXISTS "Admin Delete Access" ON storage.objects;
CREATE POLICY "Admin Delete Access"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'assets' AND
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- ---------------------------------------------------------------------------
-- 4. Storage Bucket: chronicles_media (Vérification)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('chronicles_media', 'chronicles_media', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Storage Bucket: team-members (Vérification)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-members', 'team-members', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Fonction increment_article_views (Vérification)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_article_views(article_id uuid)
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
