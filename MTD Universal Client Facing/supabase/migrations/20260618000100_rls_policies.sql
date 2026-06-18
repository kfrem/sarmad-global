-- Migration: Set up Row-Level Security (RLS) and access control policies
BEGIN;

-- Helper functions for RLS

-- 1. Get current logged-in user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid();
$$;

-- 2. Check if current user is a practice admin (role = 'admin', company_id = NULL)
CREATE OR REPLACE FUNCTION public.is_practice_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin' AND company_id IS NULL
  );
$$;

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hmrc_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 1. COMPANIES POLICIES
CREATE POLICY "Allow read access to own company" ON public.companies
    FOR SELECT TO authenticated
    USING (id = public.get_user_company_id() OR public.is_practice_admin());

CREATE POLICY "Allow write access to practice admin" ON public.companies
    FOR ALL TO authenticated
    USING (public.is_practice_admin())
    WITH CHECK (public.is_practice_admin());

-- 2. COMPANY_MODULES POLICIES
CREATE POLICY "Allow read access to own company modules" ON public.company_modules
    FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id() OR public.is_practice_admin());

CREATE POLICY "Allow write access to practice admin" ON public.company_modules
    FOR ALL TO authenticated
    USING (public.is_practice_admin())
    WITH CHECK (public.is_practice_admin());

-- 3. USERS POLICIES
CREATE POLICY "Allow select on users in same company" ON public.users
    FOR SELECT TO authenticated
    USING (company_id = public.get_user_company_id() OR id = auth.uid() OR public.is_practice_admin());

CREATE POLICY "Allow insert/update own user profile or by practice admin" ON public.users
    FOR ALL TO authenticated
    USING (id = auth.uid() OR public.is_practice_admin())
    WITH CHECK (id = auth.uid() OR public.is_practice_admin());

-- 4. ACCOUNTS POLICIES
CREATE POLICY "Allow read access to global and own company accounts" ON public.accounts
    FOR SELECT TO authenticated
    USING (company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_practice_admin());

CREATE POLICY "Allow write access to practice admin" ON public.accounts
    FOR ALL TO authenticated
    USING (public.is_practice_admin())
    WITH CHECK (public.is_practice_admin());

-- 5. HMRC_CATEGORIES POLICIES
CREATE POLICY "Allow read access to global and own company HMRC categories" ON public.hmrc_categories
    FOR SELECT TO authenticated
    USING (company_id IS NULL OR company_id = public.get_user_company_id() OR public.is_practice_admin());

CREATE POLICY "Allow write access to practice admin" ON public.hmrc_categories
    FOR ALL TO authenticated
    USING (public.is_practice_admin())
    WITH CHECK (public.is_practice_admin());

-- 6. DOCUMENTS POLICIES
CREATE POLICY "Allow read/write access to own company documents" ON public.documents
    FOR ALL TO authenticated
    USING (company_id = public.get_user_company_id() OR public.is_practice_admin())
    WITH CHECK (company_id = public.get_user_company_id() OR public.is_practice_admin());

-- 7. TRANSACTIONS POLICIES
CREATE POLICY "Allow read/write access to own company transactions" ON public.transactions
    FOR ALL TO authenticated
    USING (company_id = public.get_user_company_id() OR public.is_practice_admin())
    WITH CHECK (company_id = public.get_user_company_id() OR public.is_practice_admin());

-- 8. BANK_LINES POLICIES
CREATE POLICY "Allow read/write access to own company bank lines" ON public.bank_lines
    FOR ALL TO authenticated
    USING (company_id = public.get_user_company_id() OR public.is_practice_admin())
    WITH CHECK (company_id = public.get_user_company_id() OR public.is_practice_admin());

-- 9. AUDIT_LOG POLICIES
CREATE POLICY "Allow read/insert access to own company audit log" ON public.audit_log
    FOR ALL TO authenticated
    USING (company_id = public.get_user_company_id() OR public.is_practice_admin())
    WITH CHECK (company_id = public.get_user_company_id() OR public.is_practice_admin());

COMMIT;
