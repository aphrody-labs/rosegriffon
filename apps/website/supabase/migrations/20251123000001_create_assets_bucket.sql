-- Create the storage bucket for general assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Policy: Public Read Access for Assets
DROP POLICY IF EXISTS "Assets Public Access" ON storage.objects;
CREATE POLICY "Assets Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'assets' );

-- Policy: Admin Upload Access for Assets
-- Only users with role 'admin' in public.profiles can upload
DROP POLICY IF EXISTS "Assets Admin Upload" ON storage.objects;
CREATE POLICY "Assets Admin Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assets' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Policy: Admin Update Access for Assets
DROP POLICY IF EXISTS "Assets Admin Update" ON storage.objects;
CREATE POLICY "Assets Admin Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assets' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Policy: Admin Delete Access for Assets
DROP POLICY IF EXISTS "Assets Admin Delete" ON storage.objects;
CREATE POLICY "Assets Admin Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assets' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Cleanup old policies if they exist (from previous versions)
DROP POLICY IF EXISTS "Assets Auth Upload" ON storage.objects;
DROP POLICY IF EXISTS "Assets Owner Update" ON storage.objects;
DROP POLICY IF EXISTS "Assets Owner Delete" ON storage.objects;
