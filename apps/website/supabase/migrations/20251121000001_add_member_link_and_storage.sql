-- Migration pour ajouter la colonne member_link et créer le bucket team-members
-- Date: 2025-11-21

-- Ajouter la colonne member_link si elle n'existe pas
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS member_link text;

-- Créer le bucket team-members pour les images des membres d'équipe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-members',
  'team-members',
  true,
  5242880, -- 5MB max
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy pour permettre à tout le monde de lire les images
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'team-members');

-- Policy pour permettre aux admins d'uploader des images
DROP POLICY IF EXISTS "Admins can upload team member images" ON storage.objects;
CREATE POLICY "Admins can upload team member images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'team-members' 
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Policy pour permettre aux admins de mettre à jour des images
DROP POLICY IF EXISTS "Admins can update team member images" ON storage.objects;
CREATE POLICY "Admins can update team member images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'team-members' 
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  bucket_id = 'team-members' 
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Policy pour permettre aux admins de supprimer des images
DROP POLICY IF EXISTS "Admins can delete team member images" ON storage.objects;
CREATE POLICY "Admins can delete team member images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'team-members' 
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
