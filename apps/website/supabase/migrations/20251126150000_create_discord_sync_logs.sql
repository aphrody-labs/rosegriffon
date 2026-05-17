-- Create discord_sync_logs table
CREATE TABLE IF NOT EXISTS public.discord_sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status TEXT NOT NULL, -- 'success', 'error'
    total_members INTEGER DEFAULT 0,
    updated_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.discord_sync_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view logs
CREATE POLICY "Admins can view discord_sync_logs"
ON public.discord_sync_logs
FOR SELECT
USING (auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
));

-- Service role can insert (for cron)
-- (Service Role bypasses RLS, but we can add an explicit policy if needed, though usually not required for service role)