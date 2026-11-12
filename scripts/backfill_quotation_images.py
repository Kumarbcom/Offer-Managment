import csv
import sys
import json
import urllib.request
import urllib.error
import time

csv.field_size_limit(sys.maxsize)

TARGET_URL = 'https://hrvjlqqldbgzlvqavwwl.supabase.co'
TARGET_KEY = 'sb_publishable_zVgpGYf029VcVG_ae0hv8w_yyGUtil8'

headers = {
    'apikey': TARGET_KEY,
    'Authorization': f'Bearer {TARGET_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}

print("1. Loading product images from products_rows.csv...")
image_map = {}
with open('products_rows.csv', 'r', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    for r in reader:
        pNo = (r.get('partNo') or '').strip()
        iu = (r.get('image_url') or r.get('imageUrl') or '').strip()
        if not iu:
            pr = r.get('prices') or ''
            try:
                prices = json.loads(pr) if isinstance(pr, str) else pr
                if isinstance(prices, list):
                    for p in prices:
                        if p.get('imageUrl'):
                            iu = p.get('imageUrl').strip()
                            break
            except:
                pass
        if pNo and iu:
            image_map[pNo] = iu
            image_map[pNo.lower()] = iu
            unpadded = pNo.replace(' ', '').lstrip('0')
            if unpadded:
                image_map[unpadded] = iu
                image_map[unpadded.lower()] = iu

print(f"Loaded image map with {len(image_map)} keys.")

print("\n2. Loading fallback images from quotations_rows.csv...")
with open('quotations_rows.csv', 'r', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    for r in reader:
        d_str = r.get('details') or ''
        try:
            details = json.loads(d_str) if isinstance(d_str, str) else d_str
            if isinstance(details, list):
                for item in details:
                    pNo = (item.get('partNo') or '').strip()
                    img = (item.get('imageUrl') or item.get('image_url') or '').strip()
                    if pNo and img and pNo not in image_map:
                        image_map[pNo] = img
                        image_map[pNo.lower()] = img
                        unpadded = pNo.replace(' ', '').lstrip('0')
                        if unpadded:
                            image_map[unpadded] = img
                            image_map[unpadded.lower()] = img
        except:
            pass

print(f"Total image map keys: {len(image_map)}")

print("\n3. Fetching all quotations from Supabase that need backfill...")
offset = 0
limit = 200
total_checked = 0
total_updated = 0
total_items_restored = 0

while True:
    url = f"{TARGET_URL}/rest/v1/quotations?select=id,details&order=id.desc&offset={offset}&limit={limit}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            quotes = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching quotations at offset {offset}: {e}")
        time.sleep(2)
        continue

    if not quotes or len(quotes) == 0:
        break

    for q in quotes:
        total_checked += 1
        qid = q.get('id')
        details = q.get('details') or []
        if not isinstance(details, list) or len(details) == 0:
            continue

        changed = False
        for item in details:
            if not item.get('imageUrl'):
                pNo = (item.get('partNo') or '').strip()
                if not pNo:
                    continue
                clean_pNo = pNo.replace(' ', '')
                unpadded = clean_pNo.lstrip('0')
                matched_img = image_map.get(pNo) or image_map.get(clean_pNo) or image_map.get(pNo.lower()) or image_map.get(clean_pNo.lower()) or image_map.get(unpadded) or image_map.get(unpadded.lower())
                if matched_img:
                    item['imageUrl'] = matched_img
                    changed = True
                    total_items_restored += 1

        if changed:
            # Update quotation in Supabase
            patch_url = f"{TARGET_URL}/rest/v1/quotations?id=eq.{qid}"
            patch_data = json.dumps({'details': details}).encode('utf-8')
            patch_req = urllib.request.Request(patch_url, data=patch_data, headers=headers, method='PATCH')
            try:
                with urllib.request.urlopen(patch_req) as patch_resp:
                    total_updated += 1
            except Exception as e:
                print(f"Failed to update quotation {qid}: {e}")

    offset += limit
    print(f"  Processed {total_checked} quotations... (Updated so far: {total_updated}, Items restored: {total_items_restored})")

print(f"\n✓ FINISHED: Checked {total_checked} quotations. Updated {total_updated} quotations with {total_items_restored} restored images.")
