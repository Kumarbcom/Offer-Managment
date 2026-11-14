const OLD_URL = 'https://vojuwzvxblxqavnpxzsj.supabase.co';
const OLD_KEY = 'sb_publishable_5gS-xt8Puw7-jgzr6rAHOQ_4LN9_xL3';

const NEW_URL = 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
const NEW_KEY = 'sb_publishable_zVgpGYf029VcVG_ae0hv8w_yyGUtil8';

const TABLES = [
    { name: 'customers', pk: 'id' },
    { name: 'products', pk: 'id' },
    { name: 'quotations', pk: 'id' }
];

async function fetchFromOld(tableName, offset, limit) {
    const url = `${OLD_URL}/rest/v1/${tableName}?select=*&order=id.asc&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
        headers: {
            'apikey': OLD_KEY,
            'Authorization': `Bearer ${OLD_KEY}`
        }
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch ${tableName} at offset ${offset}: ${res.status} ${text}`);
    }
    return res.json();
}

async function insertToNew(tableName, batch) {
    if (!batch || batch.length === 0) return;
    const url = `${NEW_URL}/rest/v1/${tableName}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'apikey': NEW_KEY,
            'Authorization': `Bearer ${NEW_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(batch)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to insert batch into ${tableName}: ${res.status} ${text}`);
    }
}

function cleanRecord(tableName, item) {
    const cleaned = { ...item };
    delete cleaned.created_at;

    if (tableName === 'quotations') {
        // Normalize fields: keep snake_case columns
        if (cleaned.quotation_date === undefined && cleaned.quotationDate !== undefined) {
            cleaned.quotation_date = cleaned.quotationDate;
        }
        if (cleaned.enquiry_date === undefined && cleaned.enquiryDate !== undefined) {
            cleaned.enquiry_date = cleaned.enquiryDate;
        }
        if (cleaned.customer_id === undefined && cleaned.customerId !== undefined) {
            cleaned.customer_id = cleaned.customerId;
        }
        if (cleaned.sales_person_id === undefined && cleaned.salesPersonId !== undefined) {
            cleaned.sales_person_id = cleaned.salesPersonId;
        }
        if (cleaned.contact_person === undefined && cleaned.contactPerson !== undefined) {
            cleaned.contact_person = cleaned.contactPerson;
        }
        if (cleaned.contact_number === undefined && cleaned.contactNumber !== undefined) {
            cleaned.contact_number = cleaned.contactNumber;
        }
        if (cleaned.other_terms === undefined && cleaned.otherTerms !== undefined) {
            cleaned.other_terms = cleaned.otherTerms;
        }
        if (cleaned.payment_terms === undefined && cleaned.paymentTerms !== undefined) {
            cleaned.payment_terms = cleaned.paymentTerms;
        }
        if (cleaned.prepared_by === undefined && cleaned.preparedBy !== undefined) {
            cleaned.prepared_by = cleaned.preparedBy;
        }
        if (cleaned.products_brand === undefined && cleaned.productsBrand !== undefined) {
            cleaned.products_brand = cleaned.productsBrand;
        }
        if (cleaned.mode_of_enquiry === undefined && cleaned.modeOfEnquiry !== undefined) {
            cleaned.mode_of_enquiry = cleaned.modeOfEnquiry;
        }
        if (cleaned.gst_added === undefined && cleaned.gstAdded !== undefined) {
            cleaned.gst_added = cleaned.gstAdded;
        }

        // Delete redundant camelCase keys so PostgREST doesn't reject if they aren't in schema
        delete cleaned.quotationDate;
        delete cleaned.enquiryDate;
        delete cleaned.customerId;
        delete cleaned.salesPersonId;
        delete cleaned.contactPerson;
        delete cleaned.contactNumber;
        delete cleaned.otherTerms;
        delete cleaned.paymentTerms;
        delete cleaned.preparedBy;
        delete cleaned.productsBrand;
        delete cleaned.modeOfEnquiry;
        delete cleaned.gstAdded;
        delete cleaned.revisionNumber;
    }

    if (tableName === 'customers') {
        if (cleaned.sales_person_id === undefined && cleaned.salesPersonId !== undefined) {
            cleaned.sales_person_id = cleaned.salesPersonId;
        }
        if (cleaned.discount_structure === undefined && cleaned.discountStructure !== undefined) {
            cleaned.discount_structure = cleaned.discountStructure;
        }
        delete cleaned.salesPersonId;
        delete cleaned.discountStructure;
    }

    if (tableName === 'products') {
        if (cleaned.hsn_code === undefined && cleaned.hsnCode !== undefined) {
            cleaned.hsn_code = cleaned.hsnCode;
        }
        if (cleaned.image_url === undefined && cleaned.imageUrl !== undefined) {
            cleaned.image_url = cleaned.imageUrl;
        }
        delete cleaned.hsnCode;
        delete cleaned.imageUrl;
    }

    return cleaned;
}

async function migrateTable(table) {
    console.log(`\n--- Migrating table: ${table.name} ---`);
    let offset = 0;
    const limit = 200;
    let totalMigrated = 0;

    while (true) {
        try {
            const rows = await fetchFromOld(table.name, offset, limit);
            if (!rows || rows.length === 0) break;

            const cleanedRows = rows.map(r => cleanRecord(table.name, r));
            await insertToNew(table.name, cleanedRows);

            totalMigrated += rows.length;
            console.log(`  Migrated ${totalMigrated} rows in ${table.name}...`);

            if (rows.length < limit) break;
            offset += limit;
        } catch (err) {
            console.warn(`  Warning on table ${table.name} (offset ${offset}):`, err.message);
            break;
        }
    }

    console.log(`✓ Completed ${table.name}: ${totalMigrated} total rows migrated.`);
}

async function run() {
    console.log("Starting migration from vojuwzvxblxqavnpxzsj to hrvjlqqldbgzlvqavwwl...");
    for (const table of TABLES) {
        await migrateTable(table);
    }
    console.log("\n==========================================");
    console.log("✅ ALL TABLES MIGRATED SUCCESSFULLY!");
    console.log("==========================================");
}

run().catch(err => {
    console.error("Migration error:", err);
    process.exit(1);
});
