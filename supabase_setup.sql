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
    is_gst_included BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing tables to ensure snake_case columns exist
DO $$ 
BEGIN
    -- Products Table Migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='part_no') THEN
        ALTER TABLE products ADD COLUMN part_no TEXT;
    END IF;
    
    -- Ensure part_no is unique (required for upsert onConflict)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'products'::regclass 
        AND conname = 'products_part_no_key'
    ) THEN
        -- We use a DO block to handle potential duplicates gracefully if needed, 
        -- but here we just try to add it.
        BEGIN
            ALTER TABLE products ADD CONSTRAINT products_part_no_key UNIQUE (part_no);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not add unique constraint to part_no, possibly due to duplicates';
        END;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='hsn_code') THEN
        ALTER TABLE products ADD COLUMN hsn_code TEXT;
    END IF;

    -- Customers Table Migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='gst_no') THEN
        ALTER TABLE customers ADD COLUMN gst_no TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='contact_person') THEN
        ALTER TABLE customers ADD COLUMN contact_person TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='contact_number') THEN
        ALTER TABLE customers ADD COLUMN contact_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='sales_person_id') THEN
        ALTER TABLE customers ADD COLUMN sales_person_id BIGINT REFERENCES sales_persons(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='discount_structure') THEN
        ALTER TABLE customers ADD COLUMN discount_structure JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Quotations Table Migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='quotation_date') THEN
        ALTER TABLE quotations ADD COLUMN quotation_date DATE DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='enquiry_date') THEN
        ALTER TABLE quotations ADD COLUMN enquiry_date DATE DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='customer_id') THEN
        ALTER TABLE quotations ADD COLUMN customer_id BIGINT REFERENCES customers(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='contact_person') THEN
        ALTER TABLE quotations ADD COLUMN contact_person TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='contact_number') THEN
        ALTER TABLE quotations ADD COLUMN contact_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='other_terms') THEN
        ALTER TABLE quotations ADD COLUMN other_terms TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='payment_terms') THEN
        ALTER TABLE quotations ADD COLUMN payment_terms TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='prepared_by') THEN
        ALTER TABLE quotations ADD COLUMN prepared_by TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='products_brand') THEN
        ALTER TABLE quotations ADD COLUMN products_brand TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='sales_person_id') THEN
        ALTER TABLE quotations ADD COLUMN sales_person_id BIGINT REFERENCES sales_persons(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='mode_of_enquiry') THEN
        ALTER TABLE quotations ADD COLUMN mode_of_enquiry TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotations' AND column_name='is_gst_included') THEN
        ALTER TABLE quotations ADD COLUMN is_gst_included BOOLEAN DEFAULT false;
    END IF;

    -- Delivery Challans Table Migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_challans' AND column_name='challan_no') THEN
        ALTER TABLE delivery_challans ADD COLUMN challan_no TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_challans' AND column_name='challan_date') THEN
        ALTER TABLE delivery_challans ADD COLUMN challan_date DATE DEFAULT CURRENT_DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_challans' AND column_name='quotation_id') THEN
        ALTER TABLE delivery_challans ADD COLUMN quotation_id BIGINT REFERENCES quotations(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_challans' AND column_name='customer_id') THEN
        ALTER TABLE delivery_challans ADD COLUMN customer_id BIGINT REFERENCES customers(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_challans' AND column_name='contact_person') THEN
        ALTER TABLE delivery_challans ADD COLUMN contact_person TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_challans' AND column_name='contact_number') THEN
        ALTER TABLE delivery_challans ADD COLUMN contact_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_challans' AND column_name='prepared_by') THEN
        ALTER TABLE delivery_challans ADD COLUMN prepared_by TEXT;
    END IF;

    -- Stock Statement Table Migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_statement' AND column_name='part_no') THEN
        ALTER TABLE stock_statement ADD COLUMN part_no TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_statement' AND column_name='stock_qty') THEN
        ALTER TABLE stock_statement ADD COLUMN stock_qty NUMERIC DEFAULT 0;
    END IF;

    -- Pending Sales Orders Table Migrations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_sales_orders' AND column_name='order_no') THEN
        ALTER TABLE pending_sales_orders ADD COLUMN order_no TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_sales_orders' AND column_name='party_name') THEN
        ALTER TABLE pending_sales_orders ADD COLUMN party_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_sales_orders' AND column_name='item_name') THEN
        ALTER TABLE pending_sales_orders ADD COLUMN item_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_sales_orders' AND column_name='material_code') THEN
        ALTER TABLE pending_sales_orders ADD COLUMN material_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_sales_orders' AND column_name='part_no') THEN
        ALTER TABLE pending_sales_orders ADD COLUMN part_no TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_sales_orders' AND column_name='ordered_qty') THEN
        ALTER TABLE pending_sales_orders ADD COLUMN ordered_qty NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_sales_orders' AND column_name='balance_qty') THEN
        ALTER TABLE pending_sales_orders ADD COLUMN balance_qty NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_sales_orders' AND column_name='due_on') THEN
        ALTER TABLE pending_sales_orders ADD COLUMN due_on DATE;
    END IF;
END $$;

-- 5. Settings Table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Users Table
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

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'settings') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE settings;
    END IF;
END $$;
