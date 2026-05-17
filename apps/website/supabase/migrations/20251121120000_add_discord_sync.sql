-- Migration SQL pour ajouter les colonnes Discord à la table profiles

-- 1. Ajouter la colonne discord_id (Unique pour éviter les doublons)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS discord_id TEXT UNIQUE;

-- 2. Indexer la colonne pour des recherches rapides (utilisé par le bot /profil)
CREATE INDEX IF NOT EXISTS idx_profiles_discord_id ON public.profiles(discord_id);

-- Note: On utilise la colonne existante 'avatar_url' pour l'avatar Discord,
-- donc pas besoin de créer 'discord_avatar_url'.

-- 3. Politique RLS (Row Level Security)
-- Le Service Role a déjà tous les droits (bypass RLS).

