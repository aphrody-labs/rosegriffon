-- ============================================================================
-- MIGRATION COMPLÈTE ROSE GRIFFON
-- Étape 1/3 : Migration + Création Admin
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTIE 1 : Structure de la base de données
-- ---------------------------------------------------------------------------

-- Add avatar_url column if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Ensure role column exists with default value
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Ensure full_name column exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Create index on role for faster admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Add comments to columns
COMMENT ON COLUMN profiles.avatar_url IS 'URL to user avatar image in Supabase Storage';
COMMENT ON COLUMN profiles.role IS 'User role: user, admin, moderator, etc.';
COMMENT ON COLUMN profiles.full_name IS 'User full name for display';

-- ---------------------------------------------------------------------------
-- PARTIE 2 : Storage Bucket pour Avatars
-- ---------------------------------------------------------------------------

-- Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name)
VALUES ('avatars', 'avatars')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects for avatars bucket
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- PARTIE 3 : Policies Storage (Sécurité)
-- ---------------------------------------------------------------------------

-- Create policy to allow users to upload their own avatar
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow users to update their own avatar
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow users to delete their own avatar
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy to allow public read access to avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ---------------------------------------------------------------------------
-- PARTIE 4 : Création Admin Rose Griffon
-- ---------------------------------------------------------------------------

-- Promouvoir rosegriffonfr@gmail.com en admin
UPDATE profiles
SET
  role = 'admin',
  full_name = 'Rose Griffon Admin'
WHERE email = 'rosegriffonfr@gmail.com';

-- Si le profil n'existe pas encore (compte pas encore créé),
-- cette requête ne fera rien, mais c'est normal.
-- L'admin devra d'abord créer son compte via /login,
-- puis cette migration pourra être ré-exécutée.

-- ---------------------------------------------------------------------------
-- VÉRIFICATION : Afficher les admins
-- ---------------------------------------------------------------------------

SELECT
  id,
  email,
  role,
  full_name
FROM profiles
WHERE role = 'admin';

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================

-- Si vous voyez le compte rosegriffonfr@gmail.com avec role='admin'
-- dans les résultats ci-dessus, la migration est réussie ! ✅
--
-- Si aucun résultat, cela signifie que le compte n'existe pas encore.
-- Créez-le via /login puis ré-exécutez cette migration.
