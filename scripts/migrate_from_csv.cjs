const fs = require('fs');
const readline = require('readline');

const TARGET_URL = 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
const TARGET_KEY = 'sb_publishable_zVgpGYf029VcVG_ae0hv8w_yyGUtil8';

// Robust CSV Line Parser that handles multiline fields and quotes
function parseCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let insideQuotes = false;

        for (let i = 0; i < fileContent.length; i++) {
            const char = fileContent[i];
            const nextChar = fileContent[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    currentField += '"';
                    i++; // skip escaped quote
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                currentRow.push(currentField);
                currentField = '';
            } else if ((char === '\r' || char === '\n') && !insideQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++; // handle \r\n
                }
                currentRow.push(currentField);
                currentField = '';
                if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
                    rows.push(currentRow);
                }
                currentRow = [];
            } else {
                currentField += char;
            }
        }
        if (currentField.length > 0 || currentRow.length > 0) {
            currentRow.push(currentField);
            rows.push(currentRow);
        }

        if (rows.length === 0) return resolve([]);
        const headers = rows[0].map(h => h.trim());
        const data = [];
        for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            const obj = {};
            for (let c = 0; c < headers.length; c++) {
                obj[headers[c]] = row[c] !== undefined ? row[c] : '';
            }
            data.push(obj);
        }
        resolve(data);
    });
}

async function upsertBatch(table, batch) {
    const url = `${TARGET_URL}/rest/v1/${table}?on_conflict=id`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'apikey': TARGET_KEY,
            'Authorization': `Bearer ${TARGET_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(batch)
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to upsert to ${table}: ${res.status} ${text}`);
    }
}

async function migrateCustomers() {
    console.log('\n--- Migrating Customers ---');
    const raw = await parseCsvFile('c:/offer Management/customers_rows.csv');
    console.log(`Parsed ${raw.length} customer rows from CSV.`);

    const cleaned = raw.map(row => {
        const id = parseInt(row.id, 10);
        const spId = parseInt(row.sales_person_id || row.salesPersonId, 10) || null;
        let disc = {};
        const rawDisc = row.discount_structure || row.discountStructure;
        if (rawDisc) {
            try { disc = typeof rawDisc === 'string' ? JSON.parse(rawDisc) : rawDisc; } catch {}
        }
        return {
            id,
            name: row.name || '',
            address: row.address || '',
            city: row.city || '',
            pincode: row.pincode || '',
            sales_person_id: spId,
            salesPersonId: spId,
            discount_structure: disc
        };
    }).filter(c => !isNaN(c.id));

    const batchSize = 100;
    for (let i = 0; i < cleaned.length; i += batchSize) {
        const batch = cleaned.slice(i, i + batchSize);
        await upsertBatch('customers', batch);
        console.log(`  Customers: ${Math.min(i + batchSize, cleaned.length)} / ${cleaned.length} upserted`);
    }
    console.log(`✓ Customers migration complete (${cleaned.length} total).`);
}

async function migrateQuotations() {
    console.log('\n--- Migrating Quotations ---');
    const raw = await parseCsvFile('c:/offer Management/quotations_rows.csv');
    console.log(`Parsed ${raw.length} quotation rows from CSV.`);

    const cleaned = raw.map(row => {
        const id = parseInt(row.id, 10);
        const cId = parseInt(row.customer_id || row.customerId, 10) || null;
        const spId = parseInt(row.sales_person_id || row.salesPersonId, 10) || null;
        let details = [];
        if (row.details) {
            try { details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details; } catch {}
        }

        const qDate = row.quotation_date || row.quotationDate || null;
        const eDate = row.enquiry_date || row.enquiryDate || null;
        const gst = row.gst_added === 'true' || row.gstAdded === 'true' || row.gst_added === true || row.gstAdded === true;

        return {
            id,
            customer_id: cId,
            customerId: cId,
            sales_person_id: spId,
            salesPersonId: spId,
            quotation_date: qDate ? qDate.split('T')[0] : null,
            enquiry_date: eDate ? eDate.split('T')[0] : null,
            contact_person: row.contact_person || row.contactPerson || '',
            contact_number: row.contact_number || row.contactNumber || '',
            other_terms: row.other_terms || row.otherTerms || '',
            otherTerms: row.other_terms || row.otherTerms || '',
            payment_terms: row.payment_terms || row.paymentTerms || '',
            paymentTerms: row.payment_terms || row.paymentTerms || '',
            prepared_by: row.prepared_by || row.preparedBy || 'Kumar',
            preparedBy: row.prepared_by || row.preparedBy || 'Kumar',
            products_brand: row.products_brand || row.productsBrand || 'Lapp',
            productsBrand: row.products_brand || row.productsBrand || 'Lapp',
            mode_of_enquiry: row.mode_of_enquiry || row.modeOfEnquiry || 'Customer Email',
            modeOfEnquiry: row.mode_of_enquiry || row.modeOfEnquiry || 'Customer Email',
            status: row.status || 'Open',
            comments: row.comments || '',
            details: Array.isArray(details) ? details : [],
            gst_added: gst,
            is_gst_included: gst
        };
    }).filter(q => !isNaN(q.id));

    // Quotations can have large details payloads, so use batch size of 50
    const batchSize = 50;
    for (let i = 0; i < cleaned.length; i += batchSize) {
        const batch = cleaned.slice(i, i + batchSize);
        await upsertBatch('quotations', batch);
        console.log(`  Quotations: ${Math.min(i + batchSize, cleaned.length)} / ${cleaned.length} upserted`);
    }
    console.log(`✓ Quotations migration complete (${cleaned.length} total).`);
}

async function migrateProducts() {
    console.log('\n--- Migrating Products ---');
    console.log('Reading and parsing products CSV...');
    const raw = await parseCsvFile('c:/offer Management/products_rows.csv');
    console.log(`Parsed ${raw.length} product rows from CSV.`);

    const cleaned = raw.map(row => {
        const id = parseInt(row.id, 10);
        let prices = [];
        if (row.prices) {
            try { prices = typeof row.prices === 'string' ? JSON.parse(row.prices) : row.prices; } catch {}
        }
        return {
            id,
            partNo: row.partNo || '',
            description: row.description || '',
            hsn_code: row.hsn_code || row.hsnCode || null,
            uom: row.uom || 'Mtr',
            weight: row.weight ? parseFloat(row.weight) || 0 : 0,
            prices: Array.isArray(prices) ? prices : []
        };
    }).filter(p => !isNaN(p.id));

    const batchSize = 250;
    for (let i = 0; i < cleaned.length; i += batchSize) {
        const batch = cleaned.slice(i, i + batchSize);
        await upsertBatch('products', batch);
        if (i % 2500 === 0 || i + batchSize >= cleaned.length) {
            console.log(`  Products: ${Math.min(i + batchSize, cleaned.length)} / ${cleaned.length} upserted`);
        }
    }
    console.log(`✓ Products migration complete (${cleaned.length} total).`);
}

async function main() {
    const start = Date.now();
    console.log('==================================================');
    console.log('MIGRATING CSV DATA TO SUPABASE (hrvjlqqldbgzlvqavwwl)');
    console.log('Tables: customers, quotations, products');
    console.log('==================================================');

    await migrateCustomers();
    await migrateQuotations();
    await migrateProducts();

    console.log('\n==================================================');
    console.log(`ALL 3 TABLES MIGRATED SUCCESSFULLY in ${Math.round((Date.now() - start) / 1000)}s!`);
    console.log('==================================================');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
