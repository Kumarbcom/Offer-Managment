import csv
import json
import sys
import urllib.request
import urllib.error
import time

csv.field_size_limit(sys.maxsize)

TARGET_URL = 'https://hrvjlqqldbgzlvqavwwl.supabase.co'
TARGET_KEY = 'sb_publishable_zVgpGYf029VcVG_ae0hv8w_yyGUtil8'

def upsert_batch(table, batch, retries=3):
    url = f"{TARGET_URL}/rest/v1/{table}?on_conflict=id"
    data = json.dumps(batch).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'apikey': TARGET_KEY,
            'Authorization': f'Bearer {TARGET_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        method='POST'
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                if resp.status in (200, 201, 204):
                    return
                raise Exception(f"HTTP {resp.status}: {resp.read().decode('utf-8')}")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1.5)
                continue
            raise e

def migrate_products():
    print("\n--- Migrating Products (batch size 100 with retries) ---")
    start = time.time()
    batch = []
    total = 0
    with open('c:/offer Management/products_rows.csv', mode='r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                pid = int(row.get('id', 0))
            except:
                continue

            prices_raw = row.get('prices')
            prices = []
            if prices_raw:
                try:
                    prices = json.loads(prices_raw) if isinstance(prices_raw, str) else prices_raw
                    if not isinstance(prices, list):
                        prices = []
                except:
                    prices = []

            w_raw = row.get('weight')
            try:
                w = float(w_raw) if w_raw else 0
            except:
                w = 0

            item = {
                'id': pid,
                'partNo': row.get('partNo') or '',
                'description': row.get('description') or '',
                'hsn_code': row.get('hsn_code') or row.get('hsnCode') or None,
                'uom': row.get('uom') or 'Mtr',
                'weight': w,
                'prices': prices
            }
            batch.append(item)
            if len(batch) >= 100:
                upsert_batch('products', batch)
                total += len(batch)
                if total % 2000 == 0:
                    print(f"  Products upserted: {total} / 58851...")
                batch = []
        if batch:
            upsert_batch('products', batch)
            total += len(batch)
    print(f"✓ Completed Products: {total} rows migrated in {time.time() - start:.1f}s.")

if __name__ == '__main__':
    migrate_products()
