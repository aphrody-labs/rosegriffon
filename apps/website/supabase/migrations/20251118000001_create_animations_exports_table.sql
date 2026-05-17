-- Migration: Création de la table animations_exports
-- Description: Stocke l'historique des exports Discord & X pour les animations (Phase 3)
-- Date: 2025-11-18

-- Créer la table animations_exports
CREATE TABLE IF NOT EXISTS animations_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  animation_id TEXT NOT NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('discord', 'x', 'download')),
  format TEXT NOT NULL CHECK (format IN ('png', 'webp', 'jpg', 'gif', 'mp4')),
  file_size_mb NUMERIC(10, 2) NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  thumbnail_url TEXT,
  quality TEXT DEFAULT 'medium' CHECK (quality IN ('low', 'medium', 'high')),
  include_watermark BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  caption TEXT,
  hashtags TEXT[] DEFAULT ARRAY[]::TEXT[],
  embed_title TEXT,
  embed_color TEXT,
  is_favorite BOOLEAN DEFAULT false,
  shared_at TIMESTAMP WITH TIME ZONE,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_exports_user_id ON animations_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_export_type ON animations_exports(export_type);
CREATE INDEX IF NOT EXISTS idx_exports_created_at ON animations_exports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exports_is_favorite ON animations_exports(is_favorite);
CREATE INDEX IF NOT EXISTS idx_exports_animation_id ON animations_exports(animation_id);

-- Activer Row Level Security
ALTER TABLE animations_exports ENABLE ROW LEVEL SECURITY;

-- Politique: Utilisateurs voient leurs propres exports
CREATE POLICY "Utilisateurs voient leurs propres exports"
  ON animations_exports
  FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

-- Politique: Utilisateurs peuvent créer leurs propres exports
CREATE POLICY "Utilisateurs peuvent créer leurs exports"
  ON animations_exports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique: Utilisateurs peuvent modifier leurs propres exports
CREATE POLICY "Utilisateurs peuvent modifier leurs exports"
  ON animations_exports
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Politique: Utilisateurs peuvent supprimer leurs propres exports
CREATE POLICY "Utilisateurs peuvent supprimer leurs exports"
  ON animations_exports
  FOR DELETE
  USING (auth.uid() = user_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_exports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS trigger_exports_updated_at ON animations_exports;
CREATE TRIGGER trigger_exports_updated_at
BEFORE UPDATE ON animations_exports
FOR EACH ROW
EXECUTE FUNCTION update_exports_updated_at();

-- Créer une vue pour les statistiques d'export
CREATE OR REPLACE VIEW animations_export_stats AS
SELECT
  user_id,
  export_type,
  COUNT(*) as total_exports,
  COUNT(CASE WHEN is_favorite THEN 1 END) as favorite_count,
  AVG(file_size_mb) as avg_file_size_mb,
  MAX(created_at) as last_export_at
FROM animations_exports
GROUP BY user_id, export_type;

-- Accorder les permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON animations_exports TO authenticated;
GRANT SELECT ON animations_export_stats TO authenticated;
