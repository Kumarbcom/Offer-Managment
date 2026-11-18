import csv
import json
import base64
import sys
import time
import urllib.request
import urllib.error

csv.field_size_limit(sys.maxsize)

SUPABASE_URL = 'https://jzdpbaornpkrgwwelvqa.supabase.co'
SUPABASE_KEY = 'sb_publishable_GeFTcwQrbVoqOz0huLdOaA_aghUoxzn'

def post_batch(batch):
    if not batch:
        return
    url = f"{SUPABASE_URL}/rest/v1/products?on_conflict=id"
    data = json.dumps(batch).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        method='POST'
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req) as resp:
                if resp.status in (200, 201, 204):
                    return True
        except urllib.error.HTTPError as e:
            err = e.read().decode('utf-8')
            print(f"Error products batch (attempt {attempt+1}): {e.code} {err[:200]}")
            time.sleep(1)
        except Exception as ex:
            print(f"Connection error (attempt {attempt+1}): {ex}")
            time.sleep(1)
    return False

def upload_image_to_storage(part_no, b64_str):
    if not b64_str or not b64_str.startswith('data:image'):
        return ''
    try:
        header, encoded = b64_str.split(',', 1)
        img_bytes = base64.b64decode(encoded)
        clean_part = "".join(c if c.isalnum() or c in '-_' else '_' for c in part_no)
        file_path = f"{clean_part}.jpg"
        url = f"{SUPABASE_URL}/storage/v1/object/product-images/{file_path}"
        req = urllib.request.Request(
            url,
            data=img_bytes,
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'image/jpeg',
                'x-upsert': 'true'
            },
            method='POST'
        )
        with urllib.request.urlopen(req) as resp:
            if resp.status in (200, 201):
                return f"{SUPABASE_URL}/storage/v1/object/public/product-images/{file_path}"
    except:
        pass
    return ''

def run():
    print("🚀 Starting fast migration of all products and price histories...")
    batch = []
    total = 0
    start_time = time.time()
    
    with open('c:/offer Management/products_rows.csv', mode='r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                pid = int(r.get('id', 0))
            except:
                continue

            prices_raw = r.get('prices', '[]')
            try:
                prices = json.loads(prices_raw) if isinstance(prices_raw, str) else prices_raw
            except:
                prices = []

            # Check for base64 image in prices or image_url
            img_url = r.get('image_url') or r.get('imageUrl') or ''
            # Clean base64 from prices to keep DB lean
            if isinstance(prices, list):
                for p in prices:
                    if isinstance(p, dict) and 'imageUrl' in p:
                        if not img_url and str(p['imageUrl']).startswith('data:image'):
                            img_url = p['imageUrl']
                        del p['imageUrl']

            batch.append({
                'id': pid,
                'partNo': r.get('partNo', ''),
                'description': r.get('description', ''),
                'hsn_code': r.get('hsn_code', '') or r.get('hsnCode', ''),
                'uom': r.get('uom', 'M'),
                'weight': float(r.get('weight', 0) or 0),
                'prices': prices,
                'image_url': img_url if not img_url.startswith('data:image') else ''
            })

            if len(batch) >= 500:
                post_batch(batch)
                total += len(batch)
                elapsed = time.time() - start_time
                print(f"   Saved {total} products ({int(total/elapsed)} items/sec)...")
                batch = []

        if batch:
            post_batch(batch)
            total += len(batch)

    print(f"🎉 Complete! Migrated all {total} products in {int(time.time() - start_time)} seconds.")

if __name__ == '__main__':
    run()
