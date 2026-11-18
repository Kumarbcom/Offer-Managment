-- ====================================================================
-- SUPABASE DATABASE DISK REDUCTION SCRIPT
-- Shrinks database size from ~500 MB down to ~20-30 MB
-- Run this in Supabase Dashboard -> SQL Editor -> Run
-- ====================================================================

-- 1. Check size before cleanup
SELECT 
    table_name,
    pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS total_size,
    pg_size_pretty(pg_relation_size(quote_ident(table_name))) AS table_size,
    pg_size_pretty(pg_total_relation_size(quote_ident(table_name)) - pg_relation_size(quote_ident(table_name))) AS index_size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;

-- 2. Strip redundant base64 image strings from quotations details
-- Base64 images are dynamically loaded from the product catalog and do NOT need to be duplicated inside 4,200 quotation JSONs!
UPDATE quotations
SET details = (
    SELECT jsonb_agg(
        CASE 
            WHEN item->>'imageUrl' LIKE 'data:image%' THEN item - 'imageUrl'
            ELSE item 
        END
    )
    FROM jsonb_array_elements(details) AS item
)
WHERE details::text LIKE '%data:image%';

-- 3. Also strip base64 from initialSnapshot if present
UPDATE quotations
SET details = jsonb_set(
    details,
    '{0,_initialSnapshot,details}',
    (
        SELECT jsonb_agg(
            CASE 
                WHEN snap_item->>'imageUrl' LIKE 'data:image%' THEN snap_item - 'imageUrl'
                ELSE snap_item 
            END
        )
        FROM jsonb_array_elements(details->0->'_initialSnapshot'->'details') AS snap_item
    )
)
WHERE details->0->'_initialSnapshot' IS NOT NULL 
  AND details->0->'_initialSnapshot'->'details'::text LIKE '%data:image%';

-- 4. Truncate any realtime event backlogs
TRUNCATE TABLE IF EXISTS realtime.messages CASCADE;

-- 5. VACUUM FULL to reclaim dead disk pages immediately and shrink the database file
VACUUM FULL quotations;
VACUUM FULL products;
VACUUM FULL customers;
VACUUM FULL;

-- 6. Check size after cleanup (you should see massive reduction!)
SELECT 
    table_name,
    pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS total_size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;
