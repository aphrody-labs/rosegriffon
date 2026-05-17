CREATE TABLE IF NOT EXISTS public.stream_schedules (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    day_of_week smallint NOT NULL,
    streamer_name text NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    category text,
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stream_schedules_status ON public.stream_schedules USING btree (status);
CREATE INDEX IF NOT EXISTS idx_stream_schedules_day_of_week ON public.stream_schedules USING btree (day_of_week);

-- Trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_stream_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_stream_schedules_updated_at_trigger
BEFORE UPDATE ON public.stream_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_stream_schedules_updated_at();

-- RLS Policies
ALTER TABLE public.stream_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stream schedules are viewable by everyone." ON public.stream_schedules;
CREATE POLICY "Stream schedules are viewable by everyone."
ON public.stream_schedules FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Admins can manage stream schedules." ON public.stream_schedules;
CREATE POLICY "Admins can manage stream schedules."
ON public.stream_schedules FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
