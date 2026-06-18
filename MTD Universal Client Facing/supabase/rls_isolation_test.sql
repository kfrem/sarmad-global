-- SQL Test Script: Verify Row-Level Security (RLS) and Tenant Isolation
-- You can run this in the Supabase SQL Editor to verify that tenant isolation works.
-- It runs in a transaction and ROLLS BACK at the end so it leaves no garbage data.

BEGIN;

-- 1. SETUP TEST ENTITIES
-- Create Company A and Company B
INSERT INTO public.companies (id, name, entity_type, vat_registered)
VALUES 
  ('aaaaaaa1-bbbb-cccc-dddd-eeeeeeeeeeee', 'Test Tenant Company A', 'limited_company', TRUE),
  ('aaaaaaa2-bbbb-cccc-dddd-eeeeeeeeeeee', 'Test Tenant Company B', 'sole_trader', FALSE);

-- Insert User A (linked to Company A) and User B (linked to Company B) into auth.users (mock)
-- Note: In a real environment, users are created in the auth schema. We'll insert mock users into auth.users first.
-- In Supabase, auth.users is managed by Supabase, but for testing we can insert records.
INSERT INTO auth.users (id, email, encrypted_password)
VALUES 
  ('11111111-2222-3333-4444-555555555555', 'clientA@compA.co.uk', 'mock_pw_hash'),
  ('66666666-7777-8888-9999-000000000000', 'clientB@compB.co.uk', 'mock_pw_hash');

-- Link them in public.users
INSERT INTO public.users (id, company_id, email, role)
VALUES
  ('11111111-2222-3333-4444-555555555555', 'aaaaaaa1-bbbb-cccc-dddd-eeeeeeeeeeee', 'clientA@compA.co.uk', 'client'),
  ('66666666-7777-8888-9999-000000000000', 'aaaaaaa2-bbbb-cccc-dddd-eeeeeeeeeeee', 'clientB@compB.co.uk', 'client');

-- 2. INSERT TEST DATA AS USER A
-- We simulate being User A (setting auth.uid() and role)
SET LOCAL request.jwt.claim.sub = '11111111-2222-3333-4444-555555555555';
SET LOCAL role = 'authenticated';

-- User A uploads a document
INSERT INTO public.documents (id, company_id, type, filename, storage_path, period, status)
VALUES (
  'ddddddd1-1111-2222-3333-444444444444', 
  'aaaaaaa1-bbbb-cccc-dddd-eeeeeeeeeeee', 
  'receipt', 
  'company_A_secret_invoice.pdf', 
  'aaaaaaa1-bbbb-cccc-dddd-eeeeeeeeeeee/file.pdf', 
  '2026-Q1', 
  'pending'
);

-- User A creates a draft transaction
INSERT INTO public.transactions (id, company_id, document_id, date, description, gross_amount, net_amount, classification)
VALUES (
  'ttttttt1-1111-2222-3333-444444444444',
  'aaaaaaa1-bbbb-cccc-dddd-eeeeeeeeeeee',
  'ddddddd1-1111-2222-3333-444444444444',
  '2026-06-18',
  'Company A Purchase',
  120.00,
  100.00,
  'expense'
);

-- 3. ASSERTIONS: SIMULATE BEING USER B
-- Now we switch identity to User B (Company B)
SET LOCAL request.jwt.claim.sub = '66666666-7777-8888-9999-000000000000';
SET LOCAL role = 'authenticated';

-- TEST A: Can User B see User A's document?
-- Should return 0 rows.
DO $$
DECLARE
    doc_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO doc_count FROM public.documents WHERE id = 'ddddddd1-1111-2222-3333-444444444444';
    IF doc_count > 0 THEN
        RAISE EXCEPTION 'SECURITY BREACH: User B can see User A''s document!';
    ELSE
        RAISE NOTICE 'SUCCESS: User B cannot see User A''s document.';
    END IF;
END $$;

-- TEST B: Can User B see User A's transaction?
-- Should return 0 rows.
DO $$
DECLARE
    tx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tx_count FROM public.transactions WHERE id = 'ttttttt1-1111-2222-3333-444444444444';
    IF tx_count > 0 THEN
        RAISE EXCEPTION 'SECURITY BREACH: User B can see User A''s transaction!';
    ELSE
        RAISE NOTICE 'SUCCESS: User B cannot see User A''s transaction.';
    END IF;
END $$;

-- TEST C: Can User B modify User A's transaction?
-- Should affect 0 rows.
DO $$
DECLARE
    rows_affected INTEGER;
BEGIN
    UPDATE public.transactions 
    SET description = 'Hacked Description' 
    WHERE id = 'ttttttt1-1111-2222-3333-444444444444';
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    IF rows_affected > 0 THEN
        RAISE EXCEPTION 'SECURITY BREACH: User B modified User A''s transaction!';
    ELSE
        RAISE NOTICE 'SUCCESS: User B cannot update User A''s transaction.';
    END IF;
END $$;

-- TEST D: Can User B delete User A's document?
-- Should affect 0 rows.
DO $$
DECLARE
    rows_affected INTEGER;
BEGIN
    DELETE FROM public.documents 
    WHERE id = 'ddddddd1-1111-2222-3333-444444444444';
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    
    IF rows_affected > 0 THEN
        RAISE EXCEPTION 'SECURITY BREACH: User B deleted User A''s document!';
    ELSE
        RAISE NOTICE 'SUCCESS: User B cannot delete User A''s document.';
    END IF;
END $$;

-- Rollback the transaction to keep database clean
ROLLBACK;
