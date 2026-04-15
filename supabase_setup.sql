-- SQL to correct Supabase schema for Quotation Management System

-- 1. Sales Persons Table
CREATE TABLE IF NOT EXISTS sales_persons (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    email TEXT,
    mobile TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    pincode TEXT,
    gst_no TEXT,
    contact_person TEXT,
    contact_number TEXT,
    email TEXT,
    sales_person_id BIGINT REFERENCES sales_persons(id),
    discount_structure JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Products Table
CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    part_no TEXT NOT NULL UNIQUE,
    description TEXT,
    hsn_code TEXT,
    prices JSONB DEFAULT '[]'::jsonb,
    uom TEXT,
    plant TEXT,
    weight NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Quotations Table
CREATE TABLE IF NOT EXISTS quotations (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    quotation_date DATE DEFAULT CURRENT_DATE,
    enquiry_date DATE DEFAULT CURRENT_DATE,
    customer_id BIGINT REFERENCES customers(id),
    contact_person TEXT,
    contact_number TEXT,
    other_terms TEXT,
    payment_terms TEXT,
    prepared_by TEXT,
    products_brand TEXT,
    sales_person_id BIGINT REFERENCES sales_persons(id),
    mode_of_enquiry TEXT,
    status TEXT DEFAULT 'Open',
    comments TEXT,
    details JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Users Table
CREATE TABLE IF NOT EXISTS users (
    name TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Delivery Challans Table
CREATE TABLE IF NOT EXISTS delivery_challans (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    challan_no TEXT,
    challan_date DATE DEFAULT CURRENT_DATE,
    quotation_id BIGINT REFERENCES quotations(id),
    customer_id BIGINT REFERENCES customers(id),
    contact_person TEXT,
    contact_number TEXT,
    details JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'Pending',
    prepared_by TEXT,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Stock Statement Table
CREATE TABLE IF NOT EXISTS stock_statement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_no TEXT,
    description TEXT,
    stock_qty NUMERIC DEFAULT 0,
    uom TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Pending Sales Orders Table
CREATE TABLE IF NOT EXISTS pending_sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    due_on DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for all tables
DO $$ 
BEGIN
    -- Create publication if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add tables to publication if they are not already part of it
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sales_persons') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sales_persons;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'customers') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE customers;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'products') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE products;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'quotations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE quotations;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'users') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE users;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_challans') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE delivery_challans;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'stock_statement') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE stock_statement;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pending_sales_orders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE pending_sales_orders;
    END IF;
END $$;
