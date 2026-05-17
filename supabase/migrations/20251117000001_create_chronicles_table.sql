-- =============================================
-- Migration: Create Chronicles Table
-- Description: Système de chroniques/articles pour l'admin
-- Date: 2025-11-17
-- =============================================

-- Créer la table chronicles
CREATE TABLE IF NOT EXISTS public.chronicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'actualites',
    published BOOLEAN DEFAULT false,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Commentaire sur la table
COMMENT ON TABLE public.chronicles IS 'Chroniques et articles du journal de bord administratif';

-- Commentaires sur les colonnes
COMMENT ON COLUMN public.chronicles.title IS 'Titre de la chronique';
COMMENT ON COLUMN public.chronicles.slug IS 'URL-friendly slug (unique)';
COMMENT ON COLUMN public.chronicles.excerpt IS 'Extrait court pour les listes';
COMMENT ON COLUMN public.chronicles.content IS 'Contenu complet (Markdown supporté)';
COMMENT ON COLUMN public.chronicles.category IS 'Catégorie: actualites, projets, technique, communaute';
COMMENT ON COLUMN public.chronicles.published IS 'Publication en ligne';
COMMENT ON COLUMN public.chronicles.views_count IS 'Nombre de vues';
COMMENT ON COLUMN public.chronicles.author_id IS 'Auteur (référence auth.users)';

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_chronicles_author ON public.chronicles(author_id);
CREATE INDEX IF NOT EXISTS idx_chronicles_slug ON public.chronicles(slug);
CREATE INDEX IF NOT EXISTS idx_chronicles_published ON public.chronicles(published);
CREATE INDEX IF NOT EXISTS idx_chronicles_category ON public.chronicles(category);
CREATE INDEX IF NOT EXISTS idx_chronicles_created_at ON public.chronicles(created_at DESC);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_chronicles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_chronicles_updated_at_trigger ON public.chronicles;
CREATE TRIGGER update_chronicles_updated_at_trigger
    BEFORE UPDATE ON public.chronicles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_chronicles_updated_at();

-- =============================================
-- RLS (Row Level Security) Policies
-- =============================================

-- Activer RLS
ALTER TABLE public.chronicles ENABLE ROW LEVEL SECURITY;

-- Policy: Lecture publique (seulement chroniques publiées)
CREATE POLICY "Chronicles: Public read published"
    ON public.chronicles
    FOR SELECT
    USING (published = true);

-- Policy: Admins ont accès complet (lecture)
CREATE POLICY "Chronicles: Admin read all"
    ON public.chronicles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy: Admins peuvent créer
CREATE POLICY "Chronicles: Admin insert"
    ON public.chronicles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy: Admins peuvent modifier
CREATE POLICY "Chronicles: Admin update"
    ON public.chronicles
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy: Admins peuvent supprimer
CREATE POLICY "Chronicles: Admin delete"
    ON public.chronicles
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- =============================================
-- Données de test (optionnel)
-- =============================================

-- Insérer une chronique de test (décommenter si besoin)
-- INSERT INTO public.chronicles (title, slug, excerpt, content, category, published, author_id)
-- SELECT
--     'Bienvenue sur les Chroniques du Bouquet',
--     'bienvenue-chroniques-bouquet',
--     'Première chronique administrative de Rose Griffon.',
--     '# Bienvenue\n\nContenu complet de la chronique...',
--     'actualites',
--     true,
--     id
-- FROM auth.users
-- WHERE email = 'admin@rosegriffon.fr'
-- LIMIT 1;

-- =============================================
-- Vérifications finales
-- =============================================

-- Vérifier que la table existe
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'chronicles'
    ) THEN
        RAISE NOTICE '✅ Table chronicles créée avec succès';
    ELSE
        RAISE EXCEPTION '❌ Échec création table chronicles';
    END IF;
END $$;
