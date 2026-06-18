-- Migration: Initialize schema for Bookkeeping & Document Capture Portal
BEGIN;

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('sole_trader', 'landlord', 'limited_company', 'partnership')),
    vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
    accent_colour VARCHAR(7), -- e.g. '#2563EB'
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. COMPANY_MODULES TABLE
CREATE TABLE IF NOT EXISTS public.company_modules (
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    module_code VARCHAR(4) NOT NULL, -- UNI, CH, CN, HP, AG, CR
    PRIMARY KEY (company_id, module_code)
);

-- 3. USERS TABLE (profile table linked to auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- Null for practice admins
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'admin')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. ACCOUNTS TABLE (chart of accounts)
CREATE TABLE IF NOT EXISTS public.accounts (
    code INT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    class INT NOT NULL,
    group_code INT NOT NULL,
    nature CHAR(2) NOT NULL CHECK (nature IN ('Dr', 'Cr')),
    type VARCHAR(10) NOT NULL CHECK (type IN ('Header', 'Posting')),
    statement CHAR(2) NOT NULL CHECK (statement IN ('BS', 'PL')),
    vat_default VARCHAR(4), -- S20, R5, Z, E, OS, RC
    cashflow_category VARCHAR(50),
    statutory_line VARCHAR(120),
    description TEXT,
    industry_module VARCHAR(4) DEFAULT 'UNI',
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE -- Null for shared global accounts
);

CREATE INDEX IF NOT EXISTS idx_accounts_class_group ON public.accounts(class, group_code);
CREATE INDEX IF NOT EXISTS idx_accounts_statement ON public.accounts(statement);
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON public.accounts(is_active);

-- 5. HMRC_CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.hmrc_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    applies_to_entity_type VARCHAR(50) NOT NULL CHECK (applies_to_entity_type IN ('sole_trader', 'landlord', 'limited_company')),
    maps_to_account_code INT REFERENCES public.accounts(code) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE -- Null for shared global categories
);

-- 6. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('invoice', 'receipt', 'bank_statement', 'other')),
    filename VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    period VARCHAR(20) NOT NULL, -- e.g. '2026-Q1', '2026'
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'matched')),
    uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    archived BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_company_id ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

-- 7. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    gross_amount NUMERIC(15, 2) NOT NULL,
    net_amount NUMERIC(15, 2) NOT NULL,
    vat_code VARCHAR(4),
    vat_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    classification VARCHAR(20) NOT NULL CHECK (classification IN ('income', 'expense', 'asset', 'transfer', 'personal', 'none')),
    account_code INT REFERENCES public.accounts(code) ON DELETE SET NULL,
    hmrc_category_id UUID REFERENCES public.hmrc_categories(id) ON DELETE SET NULL,
    business_percent NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (business_percent >= 0.00 AND business_percent <= 100.00),
    is_split BOOLEAN NOT NULL DEFAULT FALSE,
    parent_transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    confirmed_at TIMESTAMPTZ,
    property_id VARCHAR(100), -- Tag income/expense to property for landlords
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transactions_company_id ON public.transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_transactions_document_id ON public.transactions(document_id);
CREATE INDEX IF NOT EXISTS idx_transactions_parent_id ON public.transactions(parent_transaction_id);

-- 8. BANK_LINES TABLE
CREATE TABLE IF NOT EXISTS public.bank_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL, -- Bank statement doc
    date DATE NOT NULL,
    description TEXT NOT NULL,
    money_in NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    money_out NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    balance NUMERIC(15, 2),
    matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    receipt_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL, -- Supporting receipt doc
    status VARCHAR(20) NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched'))
);

CREATE INDEX IF NOT EXISTS idx_bank_lines_company_id ON public.bank_lines(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_lines_matched_tx ON public.bank_lines(matched_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_lines_status ON public.bank_lines(status);

-- 9. AUDIT_LOG TABLE
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- e.g. 'create', 'update', 'confirm'
    entity VARCHAR(50) NOT NULL, -- e.g. 'transaction', 'document'
    before JSONB,
    after JSONB,
    at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON public.audit_log(company_id);

COMMIT;
