-- Add badges array to profiles table for cosmetic customization
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}';
