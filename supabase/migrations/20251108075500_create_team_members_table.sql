CREATE TABLE IF NOT EXISTS public.team_members (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id text NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    image_url text,
    display_index smallint,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members USING btree (team_id);

-- Trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_team_members_updated_at_trigger
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_team_members_updated_at();

-- RLS Policies
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members are viewable by everyone." ON public.team_members;
CREATE POLICY "Team members are viewable by everyone."
ON public.team_members FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Admins can manage team members." ON public.team_members;
CREATE POLICY "Admins can manage team members."
ON public.team_members FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
