-- ====================================================================
-- SIDDHIKABEL NEW SUPABASE DATABASE SCHEMA
-- Run this in your new Supabase Project: SQL Editor -> New Query -> Run
-- ====================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Sales Person'
);

-- 2. SALES PERSONS TABLE
CREATE TABLE IF NOT EXISTS sales_persons (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT
);

-- 3. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    pincode TEXT,
    sales_person_id INTEGER REFERENCES sales_persons(id) ON DELETE SET NULL,
    discount_structure JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_sp ON customers(sales_person_id);

-- 4. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY,
    partNo TEXT NOT NULL,
    description TEXT,
    hsn_code TEXT,
    uom TEXT DEFAULT 'Mtr',
    plant TEXT,
    weight NUMERIC DEFAULT 0,
    prices JSONB DEFAULT '[]'::jsonb,
    image_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_partNo ON products(partNo);

-- 5. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS quotations (
    id BIGINT PRIMARY KEY,
    quotation_date DATE,
    enquiry_date DATE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    sales_person_id INTEGER REFERENCES sales_persons(id) ON DELETE SET NULL,
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
    gst_added BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quotations_id_desc ON quotations(id DESC);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);

-- 6. PENDING SALES ORDERS TABLE
CREATE TABLE IF NOT EXISTS pending_sales_orders (
    id SERIAL PRIMARY KEY,
    date TIMESTAMPTZ,
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
    due_on TIMESTAMPTZ
);

-- 7. DELIVERY CHALLANS TABLE
CREATE TABLE IF NOT EXISTS delivery_challans (
    id SERIAL PRIMARY KEY,
    challan_no TEXT,
    date DATE,
    customer_name TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'Pending'
);

-- 8. Enable Public Access for the Application (Disables RLS for seamless app sync)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_persons DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;
ALTER TABLE pending_sales_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challans DISABLE ROW LEVEL SECURITY;

-- 9. SEED DEFAULT USERS
INSERT INTO users (name, password, role) VALUES
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

-- 10. SEED DEFAULT SALES PERSONS
INSERT INTO sales_persons (id, name, email, phone) VALUES
    (1, 'N Vinay Kumar', 'vinay@siddhikabel.com', '8105851098'),
    (2, 'Giridhar', 'giridhar@example.com', '9876543211'),
    (3, 'Veeresh', 'veeresh@example.com', '9876543212'),
    (4, 'Office', 'office@example.com', '9876543213')
ON CONFLICT (id) DO NOTHING;
