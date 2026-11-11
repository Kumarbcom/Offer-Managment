
import { supabase } from './supabaseClient';
import type { Customer, Product, Quotation } from './types';
import { idbGet } from './utils/idbStorage';

type TableName = 'salesPersons' | 'customers' | 'products' | 'quotations' | 'users' | 'deliveryChallans' | 'stockStatements' | 'pendingSOs';

// In-memory cache of customers for instant lookups
export const customerCache = new Map<number, Customer>();

export function cacheCustomerLocally(customer: Customer) {
    if (!customer || !customer.id) return;
    customerCache.set(Number(customer.id), customer);
}

// Eagerly hydrate customer cache from IndexedDB on startup for 0ms initial search response
if (typeof window !== 'undefined') {
    idbGet<Customer[]>('cache_customers').then(cached => {
        if (cached && Array.isArray(cached) && cached.length > 0) {
            cached.forEach(c => cacheCustomerLocally(c));
        }
    }).catch(() => {});
}

const parseSupabaseError = (error: unknown, context?: string): string => {
  const prefix = context ? `${context}: ` : '';
  try {
      if (typeof error === 'object' && error !== null) {
        const err = error as any;
        if (err.message) return `${prefix}${err.message}${err.details ? ' - ' + err.details : ''}${err.hint ? ' (' + err.hint + ')' : ''}`;
        return `${prefix}${JSON.stringify(err)}`;
      }
      return `${prefix}${String(error)}`;
  } catch (e) {
      return `${prefix}Unknown error (failed to parse original error)`;
  }
};

export const toSupabaseTableName = (name: TableName): string => {
    switch (name) {
        case 'salesPersons': return 'sales_persons'; 
        case 'customers': return 'customers';
        case 'products': return 'products';
        case 'quotations': return 'quotations';
        case 'users': return 'users';
        case 'deliveryChallans': return 'delivery_challans';
        case 'stockStatements': return 'stock_statement'; 
        case 'pendingSOs': return 'pending_sales_orders'; 
        default: return (name as string).toLowerCase();
    }
};

// Helper to check if a string is a valid UUID
const isUuid = (id: unknown): boolean => {
    if (typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

const mapToSupabase = (tableName: TableName, item: any): any => {
    if (!item) return null;
    
    // Default pass-through for tables without specific mapping
    if (tableName === 'quotations') {
        const payload: any = {
            quotation_date: item.quotationDate || item.quotation_date || null,
            enquiry_date: item.enquiryDate || item.enquiry_date || null,
            customer_id: item.customerId !== undefined ? item.customerId : item.customer_id,
            sales_person_id: item.salesPersonId !== undefined ? item.salesPersonId : item.sales_person_id,
            contact_person: item.contactPerson !== undefined ? item.contactPerson : (item.contact_person || ''),
            contact_number: item.contactNumber !== undefined ? item.contactNumber : (item.contact_number || ''),
            other_terms: item.otherTerms !== undefined ? item.otherTerms : (item.other_terms || ''),
            payment_terms: item.paymentTerms !== undefined ? item.paymentTerms : (item.payment_terms || ''),
            prepared_by: item.preparedBy !== undefined ? item.preparedBy : (item.prepared_by || 'Kumar'),
            products_brand: item.productsBrand !== undefined ? item.productsBrand : (item.products_brand || 'Lapp'),
            mode_of_enquiry: item.modeOfEnquiry !== undefined ? item.modeOfEnquiry : (item.mode_of_enquiry || 'Customer Email'),
            status: item.status || 'Open',
            comments: item.comments || '',
            details: item.details || [],
            gst_added: item.gstAdded !== undefined ? item.gstAdded : (item.gst_added !== undefined ? item.gst_added : true)
        };
        if (item.id && item.id !== 0) {
            payload.id = item.id;
        }
        // Persist revisionNumber inside details JSONB without requiring database schema changes
        if (payload.details && payload.details.length > 0) {
            payload.details = payload.details.map((d: any, idx: number) => {
                if (idx === 0) {
                    const first = { ...d };
                    if (item.revisionNumber !== undefined) first._rev = item.revisionNumber;
                    if (item.initialSnapshot) first._initialSnapshot = item.initialSnapshot;
                    return first;
                }
                return d;
            });
        }
        return payload;
    }
    if (tableName === 'customers') {
        const spId = item.sales_person_id !== undefined ? item.sales_person_id : item.salesPersonId;
        const disc = item.discount_structure !== undefined ? item.discount_structure : item.discountStructure;
        const payload: any = {
            name: item.name || '',
            address: item.address || '',
            city: item.city || '',
            pincode: item.pincode || '',
            sales_person_id: spId !== undefined && spId !== null && spId !== '' ? Number(spId) : null,
            discount_structure: disc || {}
        };
        if (item.id && item.id !== 0) {
            payload.id = item.id;
        }
        return payload;
    }
    if (tableName === 'users') {
        const payload: any = {
            name: item.name,
            password: item.password,
            role: item.role === 'Customer' && item.customerId ? `Customer:${item.customerId}` : item.role
        };
        if (item.id) payload.id = item.id;
        return payload;
    }
    if (tableName === 'products') {
        let prices = item.prices || [];
        if (item.imageUrl !== undefined) {
            let cleanImageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
            // Disallow saving local Windows paths (C:\...) as they cannot be loaded by web browsers
            if (/^(?:[a-zA-Z]:[\\/]|file:\/\/|\\\\)/i.test(cleanImageUrl)) {
                cleanImageUrl = '';
            }
            if (Array.isArray(prices) && prices.length > 0) {
                prices = prices.map(p => {
                    const updatedPrice = { ...p };
                    if (cleanImageUrl) {
                        updatedPrice.imageUrl = cleanImageUrl;
                    } else {
                        delete updatedPrice.imageUrl;
                    }
                    return updatedPrice;
                });
            }
        }
        return {
            id: item.id,
            partNo: item.partNo,
            description: item.description,
            hsn_code: item.hsnCode,
            uom: item.uom,
            weight: item.weight,
            prices: prices
        };
    }
    if (tableName === 'pendingSOs') {
        return {
            id: item.id,
            date: item.date,
            order_no: item.orderNo,
            party_name: item.partyName,
            item_name: item.itemName,
            material_code: item.materialCode,
            part_no: item.partNo,
            ordered_qty: item.orderedQty,
            balance_qty: item.balanceQty,
            rate: item.rate,
            discount: item.discount,
            value: item.value,
            due_on: item.dueOn
        };
    }
    if (tableName === 'deliveryChallans') {
        return {
            id: item.id,
            challan_date: item.challanDate,
            customer_id: item.customerId,
            quotation_id: item.quotationId,
            vehicle_no: item.vehicleNo,
            po_no: item.poNo,
            po_date: item.poDate,
            items: item.items
        };
    }
    if (tableName === 'stockStatements') {
        return {
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            value: item.value
        };
    }
    if (tableName === 'salesPersons') {
        return {
            id: item.id,
            name: item.name,
            email: item.email,
            mobile: item.mobile
        };
    }
    return item;
};

export const mapFromSupabase = (tableName: TableName, item: any): any => {
    if (!item) return null;
    
    const get = (keys: string[], fallback: any = null) => {
        for (const key of keys) {
            if (item[key] !== undefined && item[key] !== null) return item[key];
        }
        return fallback;
    };

    if (tableName === 'quotations') {
        const rawDate = get(['quotation_date', 'quotationDate'], '');
        const rawEnquiryDate = get(['enquiry_date', 'enquiryDate'], '');
        
        const parseDate = (str: any) => {
            if (!str || String(str).includes('Invalid')) return new Date();
            const date = new Date(str);
            return isNaN(date.getTime()) ? new Date() : date;
        };

        const formatToYYYYMMDD = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const id = Number(item.id);
        const customerId = Number(get(['customer_id', 'customerId']));
        const salesPersonId = Number(get(['sales_person_id', 'salesPersonId']));

        return {
            id: isNaN(id) ? 0 : id,
            quotationDate: formatToYYYYMMDD(parseDate(rawDate)),
            enquiryDate: formatToYYYYMMDD(parseDate(rawEnquiryDate)),
            customerId: isNaN(customerId) ? null : (customerId || null),
            contactPerson: get(['contact_person', 'contactPerson'], ''),
            contactNumber: get(['contact_number', 'contactNumber'], ''),
            otherTerms: get(['other_terms', 'otherTerms'], ''),
            paymentTerms: get(['payment_terms', 'paymentTerms'], ''),
            preparedBy: get(['prepared_by', 'preparedBy'], 'Kumar'),
            productsBrand: get(['products_brand', 'productsBrand'], 'Lapp'),
            salesPersonId: isNaN(salesPersonId) ? null : (salesPersonId || null),
            modeOfEnquiry: get(['mode_of_enquiry', 'modeOfEnquiry'], 'Customer Email'),
            status: item.status || 'Open',
            comments: item.comments || '',
            details: item.details || [],
            gstAdded: !!(get(['gst_added', 'gstAdded'], false)),
            revisionNumber: (item.details && item.details[0] && item.details[0]._rev) ? Number(item.details[0]._rev) : 0,
            initialSnapshot: (item.details && item.details[0] && item.details[0]._initialSnapshot) ? item.details[0]._initialSnapshot : undefined
        };
    }

    if (tableName === 'customers') {
        const cust = {
            id: Number(item.id),
            name: item.name || '',
            address: item.address || '',
            city: item.city || '',
            pincode: item.pincode || '',
            salesPersonId: Number(get(['sales_person_id', 'salesPersonId'])) || null,
            discountStructure: get(['discount_structure', 'discountStructure'], {
                singleCore: 0, multiCore: 0, specialCable: 0, accessories: 0
            })
        };
        cacheCustomerLocally(cust);
        return cust;
    }

    if (tableName === 'products') {
        const prices = item.prices || [];
        const latestPriceWithImage = Array.isArray(prices) ? prices.slice().reverse().find(p => p && p.imageUrl) : null;
        const fallbackImageUrl = latestPriceWithImage ? latestPriceWithImage.imageUrl : '';
        return {
            id: Number(item.id),
            partNo: get(['part_no', 'partNo'], ''),
            description: item.description || '',
            hsnCode: get(['hsn_code', 'hsnCode'], ''),
            uom: item.uom || 'Mtr',
            weight: Number(item.weight) || 0,
            prices: prices,
            imageUrl: get(['image_url', 'imageUrl'], fallbackImageUrl) || fallbackImageUrl
        };
    }

    if (tableName === 'pendingSOs') {
        return {
            id: Number(item.id),
            date: get(['date', 'date_col'], new Date().toISOString()),
            orderNo: get(['order_no', 'orderNo'], ''),
            partyName: get(['party_name', 'partyName'], ''),
            itemName: get(['item_name', 'itemName'], ''),
            materialCode: get(['material_code', 'materialCode'], ''),
            partNo: get(['part_no', 'partNo'], ''),
            orderedQty: Number(get(['ordered_qty', 'orderedQty'], 0)),
            balanceQty: Number(get(['balance_qty', 'balanceQty'], 0)),
            rate: Number(item.rate) || 0,
            discount: Number(item.discount) || 0,
            value: Number(item.value) || 0,
            dueOn: get(['due_on', 'dueOn'], new Date().toISOString())
        };
    }

    if (tableName === 'deliveryChallans') {
        return {
            id: Number(item.id),
            challanDate: get(['challan_date', 'challanDate'], new Date().toISOString()),
            customerId: Number(get(['customer_id', 'customerId'])) || null,
            quotationId: Number(get(['quotation_id', 'quotationId'])) || null,
            vehicleNo: get(['vehicle_no', 'vehicleNo'], ''),
            poNo: get(['po_no', 'poNo'], ''),
            poDate: get(['po_date', 'poDate'], new Date().toISOString()),
            items: item.items || []
        };
    }

    if (tableName === 'users') {
        const rawRole = item.role || '';
        const isCustomer = rawRole.startsWith('Customer:');
        return {
            id: item.id ? Number(item.id) : undefined,
            name: item.name,
            password: item.password,
            role: isCustomer ? 'Customer' : rawRole,
            customerId: isCustomer ? Number(rawRole.split(':')[1]) : undefined
        };
    }

    return item;
};

export async function get(tableName: TableName): Promise<any[]> {
    if (!supabase) throw new Error("Supabase client not initialized");
    
    // STRICT EGRESS GUARD: Never perform an exhaustive full-table scan on quotations (protects against gigabyte spikes)
    if (tableName === 'quotations') {
        return fetchLatestQuotations(50);
    }
    
    const supabaseTableName = toSupabaseTableName(tableName);
    let allData: any[] = [];
    let from = 0;
    // Quotations table contains heavy JSONB line items with images, so use smaller batches (300) to prevent 57014 statement timeouts
    let batchLimit = tableName === 'quotations' ? 200 : (tableName === 'products' ? 500 : 1000);
    
    const isUsers = tableName === 'users';
    const hasIdOrder = tableName !== 'stockStatements' && tableName !== 'pendingSOs';
    
    while (true) {
        let retries = 0;
        let data: any = null;
        let currentBatch = batchLimit;

        while (retries < 4) {
            let query = supabase.from(supabaseTableName).select('*').range(from, from + currentBatch - 1);
            
            if (isUsers) {
                query = query.order('name', { ascending: true });
            } else if (hasIdOrder) {
                query = query.order('id', { ascending: false });
            }
            
            const res = await query;
            if (!res.error) {
                data = res.data;
                break;
            }

            console.warn(`Fetch error for ${tableName} (${from} to ${from + currentBatch - 1}), attempt ${retries + 1}:`, res.error.message);
            retries++;

            // If statement timeout (57014), reduce batch size to avoid overloading Postgres
            if ((res.error.code === '57014' || res.error.message?.includes('timeout')) && currentBatch > 50) {
                currentBatch = Math.floor(currentBatch / 2);
                console.info(`Reduced batch size for ${tableName} to ${currentBatch} due to timeout.`);
            }

            if (retries >= 4) {
                console.error(`Exhausted retries fetching ${tableName}:`, JSON.stringify(res.error, null, 2));
                throw new Error(parseSupabaseError(res.error, `Failed to fetch data for ${tableName}`));
            }

            // Exponential backoff wait
            await new Promise(r => setTimeout(r, 400 * retries));
        }
        
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < currentBatch) break;
        from += data.length;
    }
    
    // Map back from Supabase snake_case to camelCase
    return allData.map((item: any) => mapFromSupabase(tableName, item));
}

export async function clearTable(tableName: TableName): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const supabaseTableName = toSupabaseTableName(tableName);
    const primaryKey = tableName === 'users' ? 'name' : 'id';
    
    // Robust Strategy: Fetch all IDs first, then delete by ID.
    // This avoids "Bad Request" errors from complex delete filters on mixed types.
    
    // 1. Fetch IDs
    const { data, error: fetchError } = await supabase
        .from(supabaseTableName)
        .select(primaryKey);

    if (fetchError) {
        throw new Error(parseSupabaseError(fetchError, `Failed to fetch IDs for clearing ${supabaseTableName}`));
    }

    if (!data || data.length === 0) return;

    const ids = data.map((item: any) => item[primaryKey]);

    // 2. Delete in Batches
    // CRITICAL FIX: Reduced batch size to 20 to prevent URL Too Long (414/400) errors with UUIDs
    const BATCH_SIZE = 20; 
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const { error: deleteError } = await supabase
            .from(supabaseTableName)
            .delete()
            .in(primaryKey, batch);
        
        if (deleteError) {
            throw new Error(parseSupabaseError(deleteError, `Failed to clear batch from ${supabaseTableName}`));
        }
    }
}

export async function set<T extends { id?: number | string, name?: string }>(tableName: TableName, previousData: T[] | null, newData: T[]): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");

    const supabaseTableName = toSupabaseTableName(tableName);
    const primaryKey = tableName === 'users' ? 'name' : 'id';
    const isUuidTable = tableName === 'stockStatements' || tableName === 'pendingSOs';

    const previousDataMap = new Map<string | number, T>();
    if (previousData) {
        previousData.forEach(item => {
            const key = primaryKey === 'name' ? item.name : item.id;
            if (key !== undefined) previousDataMap.set(key, item);
        });
    }

    const newDataMap = new Map<string | number, T>();
    newData.forEach(item => {
        const key = primaryKey === 'name' ? item.name : item.id;
        if (key !== undefined) newDataMap.set(key, item);
    });

    // Detect deletions
    let toDelete: (string | number)[] = [];
    for (const key of previousDataMap.keys()) {
        if (!newDataMap.has(key)) {
            toDelete.push(key);
        }
    }

    // SANITIZE DELETIONS: Remove non-UUID keys for UUID tables to prevent DB crash
    if (isUuidTable) {
        const originalCount = toDelete.length;
        toDelete = toDelete.filter(key => isUuid(key));
        if (toDelete.length < originalCount) {
            console.warn(`Filtered out ${originalCount - toDelete.length} invalid UUIDs from delete batch for ${tableName}`);
        }
    }

    if (toDelete.length > 0) {
        // CRITICAL FIX: Reduced batch size to 20 for deletions
        const BATCH_SIZE = 20; 
        for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = toDelete.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(supabaseTableName).delete().in(primaryKey, batch);
            if (error) throw new Error(parseSupabaseError(error, `Failed to delete batch from ${supabaseTableName}`));
        }
    }

    // Detect Upserts
    let toUpsert: T[] = [];
    for (const [key, newItem] of newDataMap.entries()) {
        const prevItem = previousDataMap.get(key);
        if (!prevItem || (prevItem !== newItem && JSON.stringify(prevItem) !== JSON.stringify(newItem))) {
            toUpsert.push(newItem);
        }
    }

    if (toUpsert.length > 0) {
        // Upserts use POST body, so larger batch size is safe
        const BATCH_SIZE = 200;
        for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
            let batch = toUpsert.slice(i, i + BATCH_SIZE);

            // Pre-processing and Mapping
            const mappedBatch = batch.map(item => {
                // Clone item
                let payload = { ...item } as any;

                // SPECIAL HANDLING: 'stockStatements' table has a generated 'value' column.
                // We must NOT send it in the INSERT/UPDATE payload.
                if (tableName === 'stockStatements') {
                    delete payload.value;
                }

                // 1. Sanitize UUIDs
                if (isUuidTable) {
                    if (payload.id && !isUuid(payload.id)) {
                        console.warn(`Stripping invalid UUID '${payload.id}' from upsert for ${tableName}`);
                        delete payload.id; // Let DB generate ID if invalid
                    }
                }

                // 2. Map Columns (CamelCase -> SnakeCase)
                payload = mapToSupabase(tableName, payload);

                return payload;
            });

            const { error } = await supabase.from(supabaseTableName).upsert(mappedBatch, { onConflict: primaryKey });
            if (error) throw new Error(parseSupabaseError(error, `Failed to upsert batch to ${supabaseTableName}`));
        }
    }
}

// --- Specific Helper Functions ---

export async function getCustomersPaginated(options: any) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    const offset = startAfterDoc || 0;

    let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order(sortBy === 'salesPerson' || sortBy === 'salesPersonId' ? 'sales_person_id' : sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageLimit - 1);
    
    if (filters?.name) query = query.ilike('name', `%${filters.name}%`);
    if (filters?.city) query = query.ilike('city', `%${filters.city}%`);
    if (filters?.salesPersonId !== undefined && filters?.salesPersonId !== null) {
        query = query.eq('sales_person_id', filters.salesPersonId);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch customers"));
    
    const mappedCustomers = (data || []).map(item => mapFromSupabase('customers', item));
    return { customers: mappedCustomers, count: count || 0 };
}

export async function searchCustomers(term: string): Promise<Customer[]> { 
    const cleanTerm = (term || '').trim();
    const localMatches: Customer[] = [];

    // 1. Instant in-memory check across customerCache (0ms)
    if (cleanTerm) {
        const words = cleanTerm.toLowerCase().split(/\s+/).filter(Boolean);
        for (const c of customerCache.values()) {
            const name = (c.name || '').toLowerCase();
            const city = (c.city || '').toLowerCase();
            const idStr = String(c.id || '');
            if (words.every(w => name.includes(w) || city.includes(w) || idStr.includes(w))) {
                localMatches.push(c);
                if (localMatches.length >= 50) break;
            }
        }
    } else {
        let count = 0;
        for (const c of customerCache.values()) {
            localMatches.push(c);
            if (++count >= 50) break;
        }
    }

    // If local cache has plenty of matching results (>= 25), return them immediately (0ms!)
    if (localMatches.length >= 25 || !supabase) {
        const cleanLower = cleanTerm.toLowerCase();
        return localMatches.sort((a, b) => {
            const aName = (a.name || '').toLowerCase();
            const bName = (b.name || '').toLowerCase();
            const aExact = aName === cleanLower ? 1 : 0;
            const bExact = bName === cleanLower ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;
            const aStarts = aName.startsWith(cleanLower) ? 1 : 0;
            const bStarts = bName.startsWith(cleanLower) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;
            return aName.localeCompare(bName);
        }).slice(0, 50);
    }

    // 2. Query Supabase
    try {
        let query = supabase.from('customers').select('*').limit(50);
        if (cleanTerm) {
            const sanitized = cleanTerm.replace(/[%_\*]/g, '').trim();
            const isNumeric = !isNaN(Number(sanitized));
            if (isNumeric) {
                query = query.or(`id.eq.${Number(sanitized)},name.ilike.%${sanitized}%,city.ilike.%${sanitized}%`);
            } else {
                query = query.or(`name.ilike.%${sanitized}%,city.ilike.%${sanitized}%`);
            }
        } else {
            query = query.order('id', { ascending: false });
        }

        const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Customer search timeout")), 6000)
        );
        const { data, error } = await Promise.race([query, timeoutPromise]) as any;
        if (error) {
            console.warn("searchCustomers failed:", error.message);
            return localMatches;
        }
        const remoteResults: Customer[] = (data || []).map((item: any) => mapFromSupabase('customers', item));
        remoteResults.forEach(c => cacheCustomerLocally(c));

        // Merge results: remoteResults + localMatches (deduplicated by id)
        const combined = new Map<number, Customer>();
        remoteResults.forEach(c => combined.set(c.id, c));
        localMatches.forEach(c => {
            if (!combined.has(c.id)) combined.set(c.id, c);
        });

        const cleanLower = cleanTerm.toLowerCase();
        return Array.from(combined.values()).sort((a, b) => {
            const aName = (a.name || '').toLowerCase();
            const bName = (b.name || '').toLowerCase();
            const aExact = aName === cleanLower ? 1 : 0;
            const bExact = bName === cleanLower ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;
            const aStarts = aName.startsWith(cleanLower) ? 1 : 0;
            const bStarts = bName.startsWith(cleanLower) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;
            return aName.localeCompare(bName);
        }).slice(0, 50);
    } catch (err) {
        console.warn("searchCustomers error:", err);
        return localMatches;
    }
}

export async function getCustomersByIds(ids: number[]) { 
    if (!supabase) return [];
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase.from('customers').select('*').in('id', ids);
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch customers by IDs"));
    return (data || []).map(item => mapFromSupabase('customers', item));
}

export async function upsertCustomer(customer: any) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const payload = mapToSupabase('customers', customer);
    const { error } = await supabase.from('customers').upsert(payload, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, 'Failed to upsert customer'));
    cacheCustomerLocally(customer);
}

export async function deleteCustomer(id: number) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw new Error(parseSupabaseError(error, 'Failed to delete customer'));
}

export async function addCustomersBatch(customers: any[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const payloads = customers.map(c => mapToSupabase('customers', c));
    const { error } = await supabase.from('customers').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, "Failed to add customers batch"));
}

// Products
export async function getProductsPaginated(options: any) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    const offset = startAfterDoc || 0;

    let query = supabase
        .from('products')
        .select('*')
        .order(sortBy === 'partNo' ? 'partNo' : (sortBy === 'hsnCode' ? 'hsn_code' : sortBy), { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageLimit - 1);
    
    if (filters.universal) {
        const pattern = `%${filters.universal.replace(/\*/g, '%').replace(/\./g, '_')}%`;
        query = query.or(`partNo.ilike."${pattern}",description.ilike."${pattern}"`);
    } else {
        if (filters.partNo) {
            const pattern = `%${filters.partNo.replace(/\*/g, '%').replace(/\./g, '_')}%`;
            query = query.ilike('partNo', pattern);
        }
        if (filters.description) {
            const pattern = `%${filters.description.replace(/\*/g, '%').replace(/\./g, '_')}%`;
            query = query.ilike('description', pattern);
        }
    }

    const { data, error } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products"));
    const products = (data || []).map(p => mapFromSupabase('products', p));
    return { products, lastVisibleDoc: offset + products.length };
}

export async function fetchAllProductsForExport() { 
    if (!supabase) throw new Error("Supabase client not initialized");
    let allProducts: Product[] = [];
    let from = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await supabase.from('products').select('*').order('partNo', { ascending: true }).range(from, from + limit - 1);
        if (error) throw new Error(parseSupabaseError(error, "Failed to fetch all products"));
        if (!data || data.length === 0) break;
        const mapped = data.map(item => mapFromSupabase('products', item));
        allProducts.push(...mapped);
        if (data.length < limit) break;
        from += limit;
    }
    return allProducts;
}

export async function addProductsBatch(products: any[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const payloads = products.map(p => mapToSupabase('products', p));
    const { error } = await supabase.from('products').upsert(payloads, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, "Failed to add products batch"));
}

export async function deleteProductsBatch(ids: number[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('products').delete().in('id', ids);
    if (error) throw new Error(parseSupabaseError(error, "Failed to delete products batch"));
}

export async function updateProduct(product: any) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const payload = mapToSupabase('products', product);
    const { id, ...productData } = payload;
    const { error } = await supabase.from('products').update(productData).eq('id', id);
    if (error) throw new Error(parseSupabaseError(error, "Failed to update product"));
}

export async function upsertQuotation(quotation: Quotation): Promise<Quotation> {
    if (!supabase) throw new Error("Supabase client not initialized");
    
    // Check if it's a new quotation (ID is 0)
    const isNew = !quotation.id || quotation.id === 0;
    
    if (isNew) {
        // Safe Insert Loop to ensure we grab the absolute highest ID without overlapping
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            // 1. Find current Max ID in DB
            const { data: maxData, error: maxError } = await supabase
                .from('quotations')
                .select('id')
                .order('id', { ascending: false })
                .limit(1);
                
            if (maxError) throw new Error(parseSupabaseError(maxError, "Failed to fetch max ID"));
            
            const currentMaxId = maxData && maxData.length > 0 ? maxData[0].id : 0;
            const nextId = currentMaxId + 1;
            
            // 2. Try to strictly INSERT with this new ID
            const payload = mapToSupabase('quotations', { ...quotation, id: nextId });
            
            const { data, error } = await supabase
                .from('quotations')
                .insert(payload)
                .select()
                .single();
                
            if (error) {
                // If it's a unique constraint violation (duplicate key), another user just grabbed this ID. Loop and retry!
                if (error.code === '23505' || String(error.message).toLowerCase().includes('duplicate')) {
                    console.warn(`Collision on ID ${nextId}, retrying... (Attempt ${attempts} of ${maxAttempts})`);
                    continue;
                }
                throw new Error(parseSupabaseError(error, "Failed to save new quotation to cloud"));
            }
            
            const saved = mapFromSupabase('quotations', data);
            broadcastQuotationUpdate(saved);
            return saved;
        }
        throw new Error("Failed to generate a unique quotation number after multiple attempts due to high server traffic. Please try again.");
    } else {
        // It's an update of an existing quotation
        const payload = mapToSupabase('quotations', quotation);
        
        const { data, error } = await supabase
            .from('quotations')
            .update(payload)
            .eq('id', payload.id)
            .select()
            .single();
            
        if (error) {
            console.error("Update error details:", error);
            throw new Error(parseSupabaseError(error, "Failed to update quotation in cloud"));
        }
        
        const saved = mapFromSupabase('quotations', data);
        broadcastQuotationUpdate(saved);
        return saved;
    }
}

// Global broadcast channel for instant multi-user synchronization across devices & browsers
export const liveQuotationSyncChannel = supabase ? supabase.channel('shared-live-quotations') : null;
if (liveQuotationSyncChannel) {
    liveQuotationSyncChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('⚡ Multi-user quotation sync broadcast channel connected');
        }
    });
}

export function broadcastQuotationUpdate(quotation: Quotation) {
    if (!liveQuotationSyncChannel || !quotation) return;
    try {
        liveQuotationSyncChannel.send({
            type: 'broadcast',
            event: 'quotation_updated',
            payload: quotation
        });
    } catch (e) {
        console.warn('Failed to broadcast quotation update:', e);
    }
}

export async function fetchLatestQuotations(limit: number = 50): Promise<Quotation[]> {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('quotations')
            .select('*')
            .order('id', { ascending: false })
            .limit(limit);
        if (error) {
            console.warn("fetchLatestQuotations query error:", error);
            return [];
        }
        return (data || []).map(q => mapFromSupabase('quotations', q));
    } catch (e) {
        console.warn("fetchLatestQuotations error:", e);
        return [];
    }
}

// Ultra-lightweight polling query (transfers <1 KB instead of ~250 KB per poll!)
export async function fetchQuotationStatuses(limit: number = 40): Promise<Array<{ id: number, status: string, comments: string }>> {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
            .from('quotations')
            .select('id, status, comments')
            .order('id', { ascending: false })
            .limit(limit);
        if (error) {
            console.warn("fetchQuotationStatuses query error:", error);
            return [];
        }
        return data || [];
    } catch (e) {
        return [];
    }
}

export async function fetchSingleQuotation(id: number): Promise<Quotation | null> {
    if (!supabase || !id) return null;
    try {
        const { data, error } = await supabase
            .from('quotations')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data) return null;
        return mapFromSupabase('quotations', data);
    } catch {
        return null;
    }
}

export async function updateQuotationField(id: number, fields: { status?: string, comments?: string, salesPersonId?: number }): Promise<void> {
    if (!supabase || !id) return;
    try {
        const payload: any = {};
        if (fields.status !== undefined) payload.status = fields.status;
        if (fields.comments !== undefined) payload.comments = fields.comments;
        if (fields.salesPersonId !== undefined) {
            payload.sales_person_id = fields.salesPersonId;
            payload.salesPersonId = fields.salesPersonId;
        }
        await supabase
            .from('quotations')
            .update(payload)
            .eq('id', id);
    } catch (e) {
        console.warn("updateQuotationField error:", e);
    }
}

// Ultra-fast in-memory product caches to eliminate redundant egress and provide 0ms response
export const productCacheById = new Map<number, Product>();
export const productCacheByPartNo = new Map<string, Product>();
export const productSearchCache = new Map<string, Product[]>();

// Eagerly hydrate product catalog cache from IndexedDB on startup for 0ms lookups
if (typeof window !== 'undefined') {
    idbGet<Product[]>('cache_products_catalog').then(cached => {
        if (cached && Array.isArray(cached) && cached.length > 0) {
            cached.forEach(p => cacheProductLocally(p, false));
        }
    }).catch(() => {});
}

let saveCatalogTimer: any = null;
function scheduleProductCatalogPersist() {
    if (typeof window === 'undefined') return;
    if (saveCatalogTimer) clearTimeout(saveCatalogTimer);
    saveCatalogTimer = setTimeout(() => {
        const allCached = Array.from(productCacheById.values());
        if (allCached.length > 0) {
            idbSet('cache_products_catalog', allCached.slice(0, 5000)).catch(() => {});
        }
    }, 1500);
}

export function cacheProductLocally(product: Product, persist = true) {
    if (!product) return;
    let added = false;
    if (product.id && typeof product.id === 'number' && product.id > 0) {
        const existing = productCacheById.get(product.id);
        if (!existing || (product.prices && product.prices.length >= (existing.prices?.length || 0))) {
            productCacheById.set(product.id, product);
            added = true;
        }
    }
    if (product.partNo && typeof product.partNo === 'string' && product.partNo.trim()) {
        const key = product.partNo.trim().toLowerCase();
        const existing = productCacheByPartNo.get(key);
        if (!existing || (product.prices && product.prices.length >= (existing.prices?.length || 0))) {
            productCacheByPartNo.set(key, product);
            added = true;
        }
    }
    if (added && persist) {
        scheduleProductCatalogPersist();
    }
}

/**
 * Hydrates commonly quoted products from loaded quotations into in-memory product cache.
 * Gives 0ms instant autocomplete for all items the team quotes regularly!
 */
export function hydrateProductsFromQuotations(quotations: Quotation[]) {
    if (!quotations || !Array.isArray(quotations)) return;
    quotations.forEach(q => {
        if (q.details && Array.isArray(q.details)) {
            q.details.forEach(item => {
                if (item && item.partNo && item.partNo.trim()) {
                    const cleanPartNo = item.partNo.trim();
                    const existing = productCacheByPartNo.get(cleanPartNo.toLowerCase());
                    if (!existing) {
                        const p: Product = {
                            id: item.productId || 0,
                            partNo: cleanPartNo,
                            description: item.description || '',
                            uom: item.uom || 'M',
                            weight: item.airFreightDetails?.weightPerMtr || 0,
                            imageUrl: item.imageUrl || '',
                            prices: item.price ? [{
                                validFrom: '2000-01-01',
                                validTo: '9999-12-31',
                                price: item.price,
                                lp: item.price,
                                sp: 0
                            } as any] : []
                        };
                        cacheProductLocally(p, false);
                    }
                }
            });
        }
    });
}

export async function searchProducts(term: string): Promise<Product[]> { 
    const cleanTerm = (term || '').trim();
    const cacheKey = cleanTerm.toLowerCase();

    // 1. Check search term query cache
    if (productSearchCache.has(cacheKey)) {
        return productSearchCache.get(cacheKey)!;
    }

    // 2. Local instant match from cached products (0ms response)
    const localMatches: Product[] = [];
    if (cleanTerm) {
        const words = cleanTerm.toLowerCase().split(/\s+/).filter(Boolean);
        for (const p of productCacheByPartNo.values()) {
            const pNo = (p.partNo || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            if (words.every(w => pNo.includes(w) || desc.includes(w))) {
                localMatches.push(p);
                if (localMatches.length >= 50) break;
            }
        }
    } else {
        let count = 0;
        for (const p of productCacheByPartNo.values()) {
            localMatches.push(p);
            if (++count >= 50) break;
        }
    }

    if (!supabase) return localMatches;

    // 3. Fast lightweight remote search without statement timeouts
    try {
        const queryPromise = (async () => {
            const sanitized = cleanTerm.replace(/[%_\*]/g, '').trim();
            if (!sanitized) {
                const { data } = await supabase
                    .from('products')
                    .select('id,partNo,description,uom,weight,hsn_code,prices')
                    .order('id', { ascending: false })
                    .limit(30);
                return (data || []).map(item => mapFromSupabase('products', item));
            }

            const combined = new Map<number, any>();

            // PRIORITY 1: Exact candidate match on partNo (runs fast, <5ms if indexed)
            const candidates = Array.from(new Set([
                sanitized,
                sanitized.toUpperCase(),
                sanitized.toLowerCase(),
                sanitized.replace(/[\s\-_]/g, '')
            ])).filter(Boolean);

            const { data: exactData, error: exactErr } = await supabase
                .from('products')
                .select('id,partNo,description,uom,weight,hsn_code,prices')
                .in('partNo', candidates)
                .limit(10);

            if (!exactErr && exactData && exactData.length > 0) {
                exactData.forEach(p => combined.set(p.id, p));
            }

            // PRIORITY 2: Prefix match on partNo (using index without leading %)
            try {
                const { data: partData, error: partErr } = await supabase
                    .from('products')
                    .select('id,partNo,description,uom,weight,hsn_code,prices')
                    .ilike('partNo', sanitized + '%')
                    .limit(35);

                if (!partErr && partData) {
                    partData.forEach(p => { if (!combined.has(p.id)) combined.set(p.id, p); });
                }
            } catch (pErr) {
                console.warn("Prefix search skipped:", pErr);
            }

            // Also check prefix with stripped spaces/hyphens if different
            const stripped = sanitized.replace(/[\s\-_]/g, '');
            if (stripped && stripped !== sanitized && combined.size < 25) {
                try {
                    const { data: strippedData } = await supabase
                        .from('products')
                        .select('id,partNo,description,uom,weight,hsn_code,prices')
                        .ilike('partNo', stripped + '%')
                        .limit(25);
                    if (strippedData) {
                        strippedData.forEach(p => { if (!combined.has(p.id)) combined.set(p.id, p); });
                    }
                } catch {}
            }

            // PRIORITY 3: If fewer than 25 results, search description
            if (combined.size < 25) {
                try {
                    const { data: descData } = await supabase
                        .from('products')
                        .select('id,partNo,description,uom,weight,hsn_code,prices')
                        .ilike('description', '%' + sanitized + '%')
                        .limit(35);

                    if (descData) {
                        descData.forEach(p => { if (!combined.has(p.id)) combined.set(p.id, p); });
                    }
                } catch (dErr) {
                    console.warn("Description search skipped:", dErr);
                }

                // If user typed OELFLEX or OLFLEX, check with ÖLFLEX too
                if (/o/i.test(sanitized) && combined.size < 25) {
                    const umlautTerm = sanitized.replace(/oe/gi, 'ö').replace(/o/gi, 'ö');
                    try {
                        const { data: umlautData } = await supabase
                            .from('products')
                            .select('id,partNo,description,uom,weight,hsn_code,prices')
                            .ilike('description', '%' + umlautTerm + '%')
                            .limit(35);
                        if (umlautData) {
                            umlautData.forEach(p => { if (!combined.has(p.id)) combined.set(p.id, p); });
                        }
                    } catch {}
                }
            }

            const lightList = Array.from(combined.values()).slice(0, 50);
            return lightList.map(item => mapFromSupabase('products', item));
        })();

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("searchProducts timeout")), 12000)
        );

        const results = await Promise.race([queryPromise, timeoutPromise]);
        results.forEach(p => cacheProductLocally(p));

        // Merge with local matches
        const combinedMap = new Map<number | string, Product>();
        results.forEach(p => combinedMap.set(p.id || p.partNo, p));
        localMatches.forEach(p => {
            const key = p.id || p.partNo;
            if (!combinedMap.has(key)) combinedMap.set(key, p);
        });

        // Exact / prefix partNo matches first!
        const cleanLower = cleanTerm.toLowerCase();
        const finalResults = Array.from(combinedMap.values()).sort((a, b) => {
            const aPart = (a.partNo || '').toLowerCase();
            const bPart = (b.partNo || '').toLowerCase();
            const aExact = aPart === cleanLower ? 1 : 0;
            const bExact = bPart === cleanLower ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;

            const aStarts = aPart.startsWith(cleanLower) ? 1 : 0;
            const bStarts = bPart.startsWith(cleanLower) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;

            return aPart.localeCompare(bPart);
        }).slice(0, 40);

        productSearchCache.set(cacheKey, finalResults);
        return finalResults;
    } catch (err) {
        console.warn("searchProducts remote call failed, returning local matches:", err);
        return localMatches;
    }
}

export async function bulkFetchProducts(partNos: string[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    if (partNos.length === 0) return [];
    
    const cleanNos = partNos.map(p => p.trim());
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('partNo', cleanNos);
      
    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to bulk fetch products"));
    }
    
    const mapped = (data || []).map(item => mapFromSupabase('products', item));
    mapped.forEach(p => cacheProductLocally(p));
    return mapped;
}

export async function getProductsByIds(ids: number[]): Promise<Product[]> { 
    if (!ids || ids.length === 0) return [];
    const validIds = ids.filter(id => typeof id === 'number' && id > 0);
    const cached: Product[] = [];
    const missing: number[] = [];
    for (const id of validIds) {
        if (productCacheById.has(id)) {
            const p = productCacheById.get(id)!;
            if (p.prices && p.prices.length > 1) {
                cached.push(p);
            } else {
                missing.push(id);
            }
        } else {
            missing.push(id);
        }
    }
    if (missing.length === 0 || !supabase) return cached;

    try {
        const { data, error } = await supabase.from('products').select('*').in('id', missing);
        if (error) {
            console.warn("getProductsByIds failed, using cached:", error.message);
            return cached;
        }
        const mapped = (data || []).map(item => mapFromSupabase('products', item));
        mapped.forEach(p => cacheProductLocally(p));
        return [...cached, ...mapped];
    } catch (e) {
        console.warn("getProductsByIds exception, using cached:", e);
        return cached;
    }
}

export async function getProductsByPartNos(partNos: string[]): Promise<Product[]> { 
    if (!partNos || partNos.length === 0) return [];
    const distinctClean = [...new Set(partNos.map(p => (p || '').trim()).filter(Boolean))];
    const cached: Product[] = [];
    const missing: string[] = [];
    for (const pNo of distinctClean) {
        const lower = pNo.toLowerCase();
        if (productCacheByPartNo.has(lower)) {
            const p = productCacheByPartNo.get(lower)!;
            if (p.prices && p.prices.length > 1) {
                cached.push(p);
            } else {
                missing.push(pNo);
            }
        } else {
            missing.push(pNo);
        }
    }
    if (missing.length === 0 || !supabase) return cached;

    try {
        const { data, error } = await supabase.from('products').select('*').in('partNo', missing);
        if (error) {
            console.warn("getProductsByPartNos failed, using cached:", error.message);
            return cached;
        }
        const mapped = (data || []).map(item => mapFromSupabase('products', item));
        mapped.forEach(p => cacheProductLocally(p));
        return [...cached, ...mapped];
    } catch (e) {
        console.warn("getProductsByPartNos exception, using cached:", e);
        return cached;
    }
}
