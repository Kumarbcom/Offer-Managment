
import { supabase } from './supabaseClient';
import type { Customer, Product, Quotation } from './types';

type TableName = 'salesPersons' | 'customers' | 'products' | 'quotations' | 'users' | 'deliveryChallans' | 'stockStatements' | 'pendingSOs';

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
        return {
            id: item.id,
            quotation_date: item.quotationDate,
            enquiry_date: item.enquiryDate,
            customer_id: item.customerId,
            sales_person_id: item.salesPersonId,
            contact_person: item.contactPerson,
            contact_number: item.contactNumber,
            other_terms: item.otherTerms,
            payment_terms: item.paymentTerms,
            prepared_by: item.preparedBy,
            products_brand: item.productsBrand,
            mode_of_enquiry: item.modeOfEnquiry,
            status: item.status,
            comments: item.comments,
            details: item.details,
            gst_added: item.gstAdded
        };
    }
    if (tableName === 'customers') {
        return {
            id: item.id,
            name: item.name,
            address: item.address,
            city: item.city,
            pincode: item.pincode,
            sales_person_id: item.salesPersonId,
            discount_structure: item.discountStructure
        };
    }
    if (tableName === 'products') {
        return {
            id: item.id,
            partNo: item.partNo,
            description: item.description,
            hsn_code: item.hsnCode,
            uom: item.uom,
            weight: item.weight,
            prices: item.prices
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

const mapFromSupabase = (tableName: TableName, item: any): any => {
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
            gstAdded: !!(get(['gst_added', 'gstAdded'], false))
        };
    }

    if (tableName === 'customers') {
        return {
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
    }

    if (tableName === 'products') {
        return {
            id: Number(item.id),
            partNo: get(['part_no', 'partNo'], ''),
            description: item.description || '',
            hsnCode: get(['hsn_code', 'hsnCode'], ''),
            uom: item.uom || 'Mtr',
            weight: Number(item.weight) || 0,
            prices: item.prices || []
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

    return item;
};

export async function get(tableName: TableName): Promise<any[]> {
    if (!supabase) throw new Error("Supabase client not initialized");
    
    const supabaseTableName = toSupabaseTableName(tableName);
    let query = supabase.from(supabaseTableName).select('*').limit(5000);

    if (tableName === 'users') {
        query = query.order('name', { ascending: true });
    } else {
        if (tableName !== 'stockStatements' && tableName !== 'pendingSOs') {
             query = query.order('id', { ascending: false });
        }
    }

    const { data, error } = await query;
    
    if (error) {
        console.error(`Error fetching ${tableName} (${supabaseTableName}):`, JSON.stringify(error, null, 2));
        throw new Error(parseSupabaseError(error, `Failed to fetch data for ${tableName}`));
    }

    // Map back from Supabase snake_case to camelCase
    if (data) {
        return data.map((item: any) => mapFromSupabase(tableName, item));
    }

    return data || [];
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
        if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(newItem)) {
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
    
    if (filters.name) query = query.ilike('name', `%${filters.name}%`);
    if (filters.city) query = query.ilike('city', `%${filters.city}%`);
    if (filters.salesPersonId) query = query.eq('sales_person_id', filters.salesPersonId);

    const { data, error, count } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch customers"));
    
    const mappedCustomers = (data || []).map(item => mapFromSupabase('customers', item));
    return { customers: mappedCustomers, count: count || 0 };
}

export async function searchCustomers(term: string) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    let query = supabase.from('customers').select('*').limit(50);
    if (term) query = query.ilike('name', `%${term}%`);
    else query = query.order('id', { ascending: false });
    const { data, error } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to search customers"));
    return (data || []).map(item => mapFromSupabase('customers', item));
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
    
    // 1. Map to snake_case
    const payload = mapToSupabase('quotations', quotation);
    
    // 2. Perform Upsert
    const { data, error } = await supabase
        .from('quotations')
        .upsert(payload)
        .select()
        .single();
        
    if (error) {
        console.error("Upsert error details:", error);
        throw new Error(parseSupabaseError(error, "Failed to save quotation to cloud"));
    }
    
    // 3. Map back to camelCase
    return mapFromSupabase('quotations', data);
}

export async function searchProducts(term: string) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    let query = supabase.from('products').select('*').limit(50);
    if (term) {
        const pattern = `%${term.replace(/\*/g, '%').replace(/\./g, '_')}%`;
        query = query.or(`partNo.ilike."${pattern}",description.ilike."${pattern}"`);
    } else {
        query = query.order('id', { ascending: false });
    }
    const { data, error } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to search products"));
    
    const results = (data || []).map(item => mapFromSupabase('products', item));
    
    // Sort results by price (low to high)
    // We use the most recent/current price as a reference
    const now = new Date();
    results.sort((a, b) => {
        const getPrice = (p: Product) => {
            if (!p.prices || p.prices.length === 0) return 0;
            const active = p.prices.find(pr => {
                const from = new Date(pr.validFrom);
                const to = new Date(pr.validTo);
                return now >= from && now <= to;
            }) || p.prices[0];
            return active.lp || active.sp || 0;
        };
        return getPrice(a) - getPrice(b);
    });

    return results;
}

export async function getProductsByIds(ids: number[]): Promise<Product[]> { 
    if (!supabase) return [];
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase.from('products').select('*').in('id', ids);
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products by IDs"));
    return (data || []).map(item => mapFromSupabase('products', item));
}

export async function getProductsByPartNos(partNos: string[]) { 
    if (!supabase) return [];
    if (!partNos || partNos.length === 0) return [];
    const distinctPartNos = [...new Set(partNos)];
    const { data, error } = await supabase.from('products').select('*').in('part_no', distinctPartNos);
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products by Part Nos"));
    return (data || []).map(item => mapFromSupabase('products', item));
}
