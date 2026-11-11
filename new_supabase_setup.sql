-- ====================================================================
-- OFFER MANAGEMENT SYSTEM - COMPLETE DATABASE SCHEMA SETUP
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hrvjlqqldbgzlvqavwwl/sql/new
-- ====================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
);

-- 2. SALES PERSONS TABLE
CREATE TABLE IF NOT EXISTS public.sales_persons (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    mobile TEXT
);

-- 3. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    pincode TEXT,
    sales_person_id BIGINT,
    discount_structure JSONB DEFAULT '{"singleCore": 0, "multiCore": 0, "specialCable": 0, "accessories": 0}'::jsonb
);

-- 4. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id BIGSERIAL PRIMARY KEY,
    "partNo" TEXT,
    description TEXT,
    hsn_code TEXT,
    uom TEXT DEFAULT 'Mtr',
    weight NUMERIC DEFAULT 0,
    prices JSONB DEFAULT '[]'::jsonb,
    image_url TEXT
);

-- 5. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotations (
    id BIGINT PRIMARY KEY,
    quotation_date DATE,
    enquiry_date DATE,
    customer_id BIGINT,
    sales_person_id BIGINT,
    contact_person TEXT,
    contact_number TEXT,
    other_terms TEXT,
    payment_terms TEXT,
    prepared_by TEXT DEFAULT 'Kumar',
    products_brand TEXT DEFAULT 'Lapp',
    mode_of_enquiry TEXT DEFAULT 'Customer Email',
    status TEXT DEFAULT 'Open',
    comments TEXT,
    details JSONB DEFAULT '[]'::jsonb,
    gst_added BOOLEAN DEFAULT TRUE
);

-- 6. DELIVERY CHALLANS TABLE
CREATE TABLE IF NOT EXISTS public.delivery_challans (
    id BIGSERIAL PRIMARY KEY,
    challan_date DATE,
    customer_id BIGINT,
    quotation_id BIGINT,
    vehicle_no TEXT,
    po_no TEXT,
    po_date DATE,
    items JSONB DEFAULT '[]'::jsonb
);

-- 7. STOCK STATEMENT TABLE
CREATE TABLE IF NOT EXISTS public.stock_statement (
    id BIGSERIAL PRIMARY KEY,
    description TEXT,
    quantity NUMERIC DEFAULT 0,
    rate NUMERIC DEFAULT 0,
    value NUMERIC DEFAULT 0
);

-- 8. PENDING SALES ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.pending_sales_orders (
    id BIGSERIAL PRIMARY KEY,
    date DATE,
    order_no TEXT,
    party_name TEXT,
    item_name TEXT,
    material_code TEXT,
    part_no TEXT,
    ordered_qty NUMERIC DEFAULT 0,
    balance_qty NUMERIC DEFAULT 0,
    rate NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    value NUMERIC DEFAULT 0,
    due_on DATE
);

-- ====================================================================
-- DISABLE RLS TO ALLOW FULL APP ACCESS VIA ANON KEY
-- ====================================================================
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_persons DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_challans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_statement DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_sales_orders DISABLE ROW LEVEL SECURITY;

-- ====================================================================
-- CREATE INDEXES FOR ULTRA-FAST SEARCHES (< 5ms response time)
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_partno ON public.products("partNo");
CREATE INDEX IF NOT EXISTS idx_products_partno_lower ON public.products(lower("partNo"));
CREATE INDEX IF NOT EXISTS idx_products_partno_trgm ON public.products USING gin ("partNo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_desc_trgm ON public.products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_city ON public.customers(city);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON public.quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON public.quotations(status);

-- ====================================================================
-- SEED DEFAULT USERS (SO YOU CAN LOG IN IMMEDIATELY)
-- ====================================================================
INSERT INTO public.users (name, password, role) VALUES
    ('Kumar', '123456', 'Admin'),
    ('Vandita', '123456', 'Admin'),
    ('Ranjan', '123456', 'Admin'),
    ('Gurudatta', '123456', 'Management'),
    ('Purshothama', '123456', 'Management'),
    ('DC Venugopal', '123456', 'Management'),
    ('Giridhar', '123456', 'Sales Person'),
    ('N Vinay Kumar', '123456', 'Sales Person'),
    ('Veeresh', '123456', 'Sales Person'),
    ('Office', '123456', 'Sales Person'),
    ('Rachana', '123456', 'SCM'),
    ('Mohan', '123456', 'SCM'),
    ('Geetha', '123456', 'SCM')
ON CONFLICT DO NOTHING;

-- ====================================================================
-- ENABLE REALTIME PUBLICATION FOR MULTI-USER INSTANT SYNC
-- ====================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_persons;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- SEED INITIAL SALES PERSONS
INSERT INTO public.sales_persons (name, email, mobile) VALUES
    ('Giridhar', 'giridhar@example.com', '9876543210'),
    ('N Vinay Kumar', 'vinay@example.com', '9876543211'),
    ('Veeresh', 'veeresh@example.com', '9876543212'),
    ('Office', 'office@example.com', '9876543213')
ON CONFLICT DO NOTHING;
