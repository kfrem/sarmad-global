-- Migration: Set up storage buckets and RLS policies on storage objects
BEGIN;

-- 1. Create the 'documents' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents', 
    'documents', 
    FALSE, -- Keep private, access via authenticated signed URLs
    52428800, -- 50MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Define Storage RLS Policies
-- Note: storage.objects name contains the full path e.g. "company-uuid/document-uuid/file.png"
-- The first segment (split by '/') is the company_id.

-- Drop existing policies if they exist to avoid errors on run
DROP POLICY IF EXISTS "Select own company storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Insert own company storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Delete own company storage objects" ON storage.objects;

-- SELECT Policy
CREATE POLICY "Select own company storage objects" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'documents' 
        AND (
            (split_part(name, '/', 1)) = public.get_user_company_id()::text 
            OR public.is_practice_admin()
        )
    );

-- INSERT Policy
CREATE POLICY "Insert own company storage objects" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'documents' 
        AND (
            (split_part(name, '/', 1)) = public.get_user_company_id()::text 
            OR public.is_practice_admin()
        )
    );

-- DELETE Policy
CREATE POLICY "Delete own company storage objects" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'documents' 
        AND (
            (split_part(name, '/', 1)) = public.get_user_company_id()::text 
            OR public.is_practice_admin()
        )
    );

COMMIT;
