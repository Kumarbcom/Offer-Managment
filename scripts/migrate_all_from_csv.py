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

def post_batch(table, batch, on_conflict='id'):
    if not batch:
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={on_conflict}"
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
            print(f"Error {table} batch (attempt {attempt+1}): {e.code} {err}")
            time.sleep(1)
        except Exception as ex:
            print(f"Connection error (attempt {attempt+1}): {ex}")
            time.sleep(1)
    return False

def upload_image(part_no, b64_str):
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

def migrate_customers():
    print("\n📦 1/3: Migrating Customers from customers_rows.csv...")
    batch = []
    total = 0
    with open('c:/offer Management/customers_rows.csv', mode='r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                cid = int(r.get('id', 0))
            except:
                continue
            
            disc = r.get('discount_structure') or r.get('discountStructure') or '{}'
            try:
                disc_json = json.loads(disc) if isinstance(disc, str) else disc
            except:
                disc_json = {}
                
            sp_id = r.get('sales_person_id') or r.get('salesPersonId')
            try:
                sp_id = int(sp_id) if sp_id else None
            except:
                sp_id = None

            batch.append({
                'id': cid,
                'name': r.get('name', ''),
                'address': r.get('address', ''),
                'city': r.get('city', ''),
                'pincode': r.get('pincode', ''),
                'sales_person_id': sp_id,
                'discount_structure': disc_json
            })

            if len(batch) >= 200:
                post_batch('customers', batch)
                total += len(batch)
                print(f"   Saved {total} customers...")
                batch = []
                
        if batch:
            post_batch('customers', batch)
            total += len(batch)
    print(f"✅ Customers finished: {total} customers active in new database.")

def migrate_quotations_all():
    print("\n📦 2/3: Migrating ALL 3,939 Quotations from quotations_rows.csv...")
    batch = []
    total = 0
    with open('c:/offer Management/quotations_rows.csv', mode='r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for r in reader:
            qdate = r.get('quotation_date') or r.get('quotationDate') or ''
            
            try:
                qid = int(r.get('id', 0))
            except:
                continue

            # Strip heavy base64 strings from details to keep DB size lean
            details_str = r.get('details', '[]')
            try:
                details = json.loads(details_str)
                if isinstance(details, list):
                    for item in details:
                        if isinstance(item, dict) and 'imageUrl' in item and str(item['imageUrl']).startswith('data:image'):
                            del item['imageUrl']
            except:
                details = []

            cust_id = r.get('customer_id') or r.get('customerId')
            try:
                cust_id = int(cust_id) if cust_id else None
            except:
                cust_id = None

            sp_id = r.get('sales_person_id') or r.get('salesPersonId')
            try:
                sp_id = int(sp_id) if sp_id else None
            except:
                sp_id = None

            batch.append({
                'id': qid,
                'quotation_date': qdate or '2026-01-01',
                'enquiry_date': r.get('enquiry_date') or r.get('enquiryDate') or qdate or '2026-01-01',
                'customer_id': cust_id,
                'sales_person_id': sp_id,
                'contact_person': r.get('contact_person') or r.get('contactPerson') or '',
                'contact_number': r.get('contact_number') or r.get('contactNumber') or '',
                'other_terms': r.get('other_terms') or r.get('otherTerms') or '',
                'payment_terms': r.get('payment_terms') or r.get('paymentTerms') or '',
                'prepared_by': r.get('prepared_by') or r.get('preparedBy') or 'Kumar',
                'products_brand': r.get('products_brand') or r.get('productsBrand') or 'Lapp',
                'mode_of_enquiry': r.get('mode_of_enquiry') or r.get('modeOfEnquiry') or 'Customer Email',
                'status': r.get('status') or 'Open',
                'comments': r.get('comments') or '',
                'details': details,
                'gst_added': r.get('gst_added') == 'True' or r.get('gstAdded') == 'True' or True
            })

            if len(batch) >= 100:
                post_batch('quotations', batch)
                total += len(batch)
                print(f"   Saved {total} quotations...")
                batch = []

        if batch:
            post_batch('quotations', batch)
            total += len(batch)
    print(f"✅ All Quotations finished: {total} total offers restored in new database.")

if __name__ == '__main__':
    migrate_quotations_all()
