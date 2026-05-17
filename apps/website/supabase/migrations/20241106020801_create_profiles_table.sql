-- ============================================================================
-- MIGRATION PROFILES - Création de la table des profils utilisateurs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PARTIE 1 : Création de la table `profiles`
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Ajouter les colonnes manquantes si elles n'existent pas
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Ajouter les contraintes si elles n'existent pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_username_key' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_email_key' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'username_length'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT username_length CHECK (char_length(username) >= 3);
  END IF;
END $$;

-- Ajout de commentaires pour la clarté
COMMENT ON TABLE public.profiles IS 'Table to store user profile information.';
COMMENT ON COLUMN public.profiles.id IS 'Links to auth.users.id';
COMMENT ON COLUMN public.profiles.username IS 'Public user name';
COMMENT ON COLUMN public.profiles.email IS 'User email for contact and notifications';


-- ---------------------------------------------------------------------------
-- PARTIE 2 : Fonction et Trigger pour la synchronisation avec `auth.users`
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (
    new.id, 
    new.email,
    -- Extract username from email if available, otherwise use a default
    COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Création du trigger qui s'active après l'insertion d'un nouvel utilisateur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ---------------------------------------------------------------------------
-- PARTIE 3 : Sécurité et Policies RLS
-- ---------------------------------------------------------------------------
-- Activer Row Level Security sur la table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir tous les profils (pour les @mentions, etc.)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

-- Les utilisateurs peuvent mettre à jour leur propre profil
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can update their own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================
