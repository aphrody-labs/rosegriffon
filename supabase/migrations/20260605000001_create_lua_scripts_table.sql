-- Migration: Create inagle_lua_scripts table
-- Created at: 2026-06-05

CREATE TABLE IF NOT EXISTS public.inagle_lua_scripts (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    version text,
    category text, -- p0/p1/p2
    functions jsonb DEFAULT '[]'::jsonb,
    calls jsonb DEFAULT '{}'::jsonb,
    strings jsonb DEFAULT '[]'::jsonb,
    crc32_numbers jsonb DEFAULT '[]'::jsonb,
    hash text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Index pour la recherche rapide par catégorie/nom
CREATE INDEX IF NOT EXISTS idx_inagle_lua_scripts_category ON public.inagle_lua_scripts(category);
CREATE INDEX IF NOT EXISTS idx_inagle_lua_scripts_name ON public.inagle_lua_scripts(name);

-- Enable RLS
ALTER TABLE public.inagle_lua_scripts ENABLE ROW LEVEL SECURITY;

-- Policy for Public Read Access
DROP POLICY IF EXISTS "inagle_lua_scripts_public_read" ON public.inagle_lua_scripts;
CREATE POLICY "inagle_lua_scripts_public_read"
ON public.inagle_lua_scripts FOR SELECT
USING (true);

-- Policy for Admin Manage Access
DROP POLICY IF EXISTS "Admin manage inagle_lua_scripts" ON public.inagle_lua_scripts;
CREATE POLICY "Admin manage inagle_lua_scripts"
ON public.inagle_lua_scripts TO authenticated
USING (public.is_admin());
