-- Migration: Création table Chroniques du Bouquet
-- Date: 16 novembre 2025
-- Description: Journal de bord Rose Griffon pour informer les utilisateurs des dernières actualités

-- Table principale des chroniques
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Métadonnées
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  
  -- Média
  featured_image_url TEXT,
  featured_image_alt VARCHAR(255),
  
  -- Taxonomie
  category VARCHAR(100),
  tags TEXT[], -- Array de tags
  
  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  
  -- Statut de publication
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  
  -- Relations
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Statistiques
  view_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_articles_author ON public.articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_status ON public.articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published ON public.articles(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION update_articles_updated_at();

-- RLS Policies
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Policy: Tout le monde peut lire les chroniques publiées
CREATE POLICY "Chroniques publiées visibles par tous"
  ON public.articles
  FOR SELECT
  USING (status = 'published');

-- Policy: Les rédacteurs peuvent voir leurs propres chroniques (tous statuts)
CREATE POLICY "Les rédacteurs voient leurs chroniques"
  ON public.articles
  FOR SELECT
  USING (auth.uid() = author_id);

-- Policy: Les rédacteurs peuvent créer des chroniques
CREATE POLICY "Les rédacteurs peuvent créer des chroniques"
  ON public.articles
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Policy: Les rédacteurs peuvent modifier leurs chroniques
CREATE POLICY "Les rédacteurs peuvent modifier leurs chroniques"
  ON public.articles
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Policy: Les rédacteurs peuvent supprimer leurs chroniques
CREATE POLICY "Les rédacteurs peuvent supprimer leurs chroniques"
  ON public.articles
  FOR DELETE
  USING (auth.uid() = author_id);

-- Policy: Les admins peuvent tout faire
CREATE POLICY "Les admins ont accès total aux chroniques"
  ON public.articles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Table pour les catégories de chroniques
CREATE TABLE IF NOT EXISTS public.article_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color: #RRGGBB
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catégories par défaut (Chroniques du Bouquet)
INSERT INTO public.article_categories (name, slug, description, color) VALUES
  ('Actualités RG', 'actualites-rg', 'Dernières nouvelles de Rose Griffon', '#A14B3F'),
  ('Événements', 'evenements', 'Annonces d''événements à venir', '#F97316'),
  ('RGTV', 'rgtv', 'Actualités Rose Griffon TV', '#8B5CF6'),
  ('Communauté', 'communaute', 'Histoires et témoignages de la communauté', '#EC4899'),
  ('Projets', 'projets', 'Avancement des projets en cours', '#3B82F6')
ON CONFLICT (slug) DO NOTHING;

-- RLS pour catégories (lecture publique)
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les catégories sont visibles par tous"
  ON public.article_categories
  FOR SELECT
  TO PUBLIC
  USING (true);

-- Fonction pour générer un slug unique
CREATE OR REPLACE FUNCTION generate_article_slug(title TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Générer slug de base (minuscules, remplacer espaces par tirets, supprimer caractères spéciaux)
  base_slug := lower(regexp_replace(
    regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
  
  final_slug := base_slug;
  
  -- Vérifier unicité et incrémenter si nécessaire
  WHILE EXISTS (SELECT 1 FROM public.articles WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.articles IS '📰 Chroniques du Bouquet - Journal de bord Rose Griffon pour informer les utilisateurs des dernières actualités';
COMMENT ON TABLE public.article_categories IS 'Catégories des Chroniques du Bouquet';
