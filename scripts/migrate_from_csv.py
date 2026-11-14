import csv
import json
import sys
import urllib.request
import urllib.error
import time

csv.field_size_limit(sys.maxsize)

TARGET_URL = 'https://hrvjlqqldbgzlvqavwwl.supabase.co'
TARGET_KEY = 'sb_publishable_zVgpGYf029VcVG_ae0hv8w_yyGUtil8'

def upsert_batch(table, batch):
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
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status not in (200, 201, 204):
                raise Exception(f"HTTP {resp.status}: {resp.read().decode('utf-8')}")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        print(f"Error upserting to {table}: {e.code} {err_msg}")
        if batch and len(batch) > 0:
            print("First item sample:", json.dumps(batch[0])[:300])
        raise Exception(f"HTTP {e.code}: {err_msg}")

def migrate_customers():
    print("\n--- Migrating Customers ---")
    start = time.time()
    batch = []
    total = 0
    with open('c:/offer Management/customers_rows.csv', mode='r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                cid = int(row.get('id', 0))
            except:
                continue
            
            sp_raw = row.get('sales_person_id') or row.get('salesPersonId')
            try:
                sp_id = int(sp_raw) if sp_raw else None
            except:
                sp_id = None

            disc_raw = row.get('discount_structure') or row.get('discountStructure')
            disc = {}
            if disc_raw:
                try:
                    disc = json.loads(disc_raw) if isinstance(disc_raw, str) else disc_raw
                except:
                    disc = {}

            item = {
                'id': cid,
                'name': row.get('name') or '',
                'address': row.get('address') or '',
                'city': row.get('city') or '',
                'pincode': row.get('pincode') or '',
                'sales_person_id': sp_id,
                'discount_structure': disc
            }
            batch.append(item)
            if len(batch) >= 100:
                upsert_batch('customers', batch)
                total += len(batch)
                print(f"  Customers upserted: {total}...")
                batch = []
        if batch:
            upsert_batch('customers', batch)
            total += len(batch)
    print(f"✓ Completed Customers: {total} rows migrated in {time.time() - start:.1f}s.")

def migrate_quotations():
    print("\n--- Migrating Quotations ---")
    start = time.time()
    batch = []
    total = 0
    with open('c:/offer Management/quotations_rows.csv', mode='r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                qid = int(row.get('id', 0))
            except:
                continue

            c_raw = row.get('customer_id') or row.get('customerId')
            try:
                cid = int(c_raw) if c_raw else None
            except:
                cid = None

            sp_raw = row.get('sales_person_id') or row.get('salesPersonId')
            try:
                sp_id = int(sp_raw) if sp_raw else None
            except:
                sp_id = None

            details_raw = row.get('details')
            details = []
            if details_raw:
                try:
                    details = json.loads(details_raw) if isinstance(details_raw, str) else details_raw
                    if not isinstance(details, list):
                        details = []
                except:
                    details = []

            q_date = row.get('quotation_date') or row.get('quotationDate') or None
            if q_date:
                q_date = q_date.split('T')[0].strip() or None
            e_date = row.get('enquiry_date') or row.get('enquiryDate') or None
            if e_date:
                e_date = e_date.split('T')[0].strip() or None

            gst_raw = str(row.get('gst_added') or row.get('gstAdded')).lower()
            gst = gst_raw in ('true', '1', 't')

            item = {
                'id': qid,
                'customer_id': cid,
                'sales_person_id': sp_id,
                'quotation_date': q_date,
                'enquiry_date': e_date,
                'contact_person': row.get('contact_person') or row.get('contactPerson') or '',
                'contact_number': row.get('contact_number') or row.get('contactNumber') or '',
                'other_terms': row.get('other_terms') or row.get('otherTerms') or '',
                'payment_terms': row.get('payment_terms') or row.get('paymentTerms') or '',
                'prepared_by': row.get('prepared_by') or row.get('preparedBy') or 'Kumar',
                'products_brand': row.get('products_brand') or row.get('productsBrand') or 'Lapp',
                'mode_of_enquiry': row.get('mode_of_enquiry') or row.get('modeOfEnquiry') or 'Customer Email',
                'status': row.get('status') or 'Open',
                'comments': row.get('comments') or '',
                'details': details,
                'gst_added': gst
            }
            batch.append(item)
            if len(batch) >= 50:
                upsert_batch('quotations', batch)
                total += len(batch)
                if total % 500 == 0:
                    print(f"  Quotations upserted: {total}...")
                batch = []
        if batch:
            upsert_batch('quotations', batch)
            total += len(batch)
    print(f"✓ Completed Quotations: {total} rows migrated in {time.time() - start:.1f}s.")

def migrate_products():
    print("\n--- Migrating Products ---")
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
            if len(batch) >= 250:
                upsert_batch('products', batch)
                total += len(batch)
                if total % 2500 == 0:
                    print(f"  Products upserted: {total}...")
                batch = []
        if batch:
            upsert_batch('products', batch)
            total += len(batch)
    print(f"✓ Completed Products: {total} rows migrated in {time.time() - start:.1f}s.")

if __name__ == '__main__':
    t0 = time.time()
    print("==========================================================")
    print("MIGRATING 3 TABLES FROM CSV TO SUPABASE (hrvjlqqldbgzlvqavwwl)")
    print("==========================================================")
    migrate_customers()
    migrate_quotations()
    migrate_products()
    print("\n==========================================================")
    print(f"ALL 3 TABLES SUCCESSFULLY MIGRATED in {time.time() - t0:.1f}s!")
    print("==========================================================")
