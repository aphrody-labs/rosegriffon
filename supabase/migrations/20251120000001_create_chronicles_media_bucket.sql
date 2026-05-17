-- Create the storage bucket for chronicles media
INSERT INTO storage.buckets (id, name)
VALUES ('chronicles-media', 'chronicles-media')
ON CONFLICT (id) DO NOTHING;

-- Policy: Public Read Access
-- Allows anyone to view files in the 'chronicles-media' bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'chronicles-media' );

-- Policy: Authenticated Upload Access
-- Allows authenticated users to upload files to the 'chronicles-media' bucket
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'chronicles-media' );

-- Policy: Owner Update Access
-- Allows users to update files they own
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'chronicles-media' AND auth.uid() = owner );

-- Policy: Owner Delete Access
-- Allows users to delete files they own
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'chronicles-media' AND auth.uid() = owner );
