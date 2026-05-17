-- Add new columns to profiles table for enhanced user profile
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_handle TEXT;

-- Update RLS policies if necessary (usually existing update policy covers all columns, but good to check)
-- Assuming existing policy allows users to update their own profile rows.
