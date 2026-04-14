-- =====================================================================
-- SUPABASE RLS FIX — Run this in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → paste → Run
-- =====================================================================
-- This fixes the "quotations saving locally but not to cloud" issue.
-- Root cause: RLS (Row Level Security) is blocking anonymous writes.
-- Since this app uses its own auth (not Supabase Auth), we allow
-- all operations for the anonymous key on all app tables.
-- =====================================================================

-- 1. QUOTATIONS
ALTER TABLE quotations DISABLE ROW LEVEL SECURITY;

-- 2. USERS
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 3. CUSTOMERS
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;

-- 4. PRODUCTS
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- 5. SALES PERSONS
ALTER TABLE sales_persons DISABLE ROW LEVEL SECURITY;

-- 6. STOCK STATEMENT
ALTER TABLE stock_statement DISABLE ROW LEVEL SECURITY;

-- 7. PENDING SALES ORDERS
ALTER TABLE pending_sales_orders DISABLE ROW LEVEL SECURITY;

-- =====================================================================
-- ALTERNATIVE: If you want to keep RLS enabled (more secure),
-- run these instead of the DISABLE commands above:
-- =====================================================================
/*
CREATE POLICY "allow_all_anon_quotations"     ON quotations          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon_users"          ON users               FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon_customers"      ON customers           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon_products"       ON products            FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon_sales_persons"  ON sales_persons       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon_stock"          ON stock_statement     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anon_pending_so"     ON pending_sales_orders FOR ALL TO anon USING (true) WITH CHECK (true);
*/

-- =====================================================================
-- VERIFY: After running, test with:
-- =====================================================================
-- SELECT * FROM quotations LIMIT 5;
-- INSERT INTO quotations (id, status) VALUES (999999999, 'test') RETURNING id;
-- DELETE FROM quotations WHERE id = 999999999;
