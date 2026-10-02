-- Secure the 'avatars' storage bucket
-- Set max file size to 2MB (2097152 bytes)
-- Restrict allowed mime types to images only
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'avatars';
