-- Migration: Create comments table for real-time article & stream comments
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL, -- 'article' ou 'stream'
  target_id TEXT NOT NULL, -- le slug de l'article ou l'id de la chaine de stream
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Read policy: anyone can read comments
CREATE POLICY "Public read access to comments" ON public.comments
  FOR SELECT USING (true);

-- Insert policy: authenticated users can insert comments as themselves
CREATE POLICY "Authenticated users can insert comments" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update policy: users can update their own comments
CREATE POLICY "Users can update their own comments" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Delete policy: users can delete their own comments
CREATE POLICY "Users can delete their own comments" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS comments_target_idx ON public.comments(target_type, target_id);
