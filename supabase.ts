
import { supabase } from './supabaseClient';
import type { Customer, Product } from './types';

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

const mapToSupabase = (tableName: TableName, item: any) => {
    // 1. Specific table overrides
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

    // 2. Generic snake_case mapping for all tables to prevent RLS/Column mismatch issues
    // CRITICAL: We ONLY send snake_case fields to Supabase. Sending both camelCase and snake_case causes validation errors.
    const mapped: any = {};
    
    // Always include ID
    if ('id' in item) mapped.id = item.id;
    
    // Convert common Quotation / Product / Customer fields if they exist
    if ('customerId' in item) mapped.customer_id = item.customerId;
    if ('quotationDate' in item) mapped.quotation_date = item.quotationDate;
    if ('enquiryDate' in item) mapped.enquiry_date = item.enquiryDate;
    if ('salesPersonId' in item) mapped.sales_person_id = item.salesPersonId;
    if ('contactPerson' in item) mapped.contact_person = item.contactPerson;
    if ('contactNumber' in item) mapped.contact_number = item.contactNumber;
    if ('productsBrand' in item) mapped.products_brand = item.productsBrand;
    if ('modeOfEnquiry' in item) mapped.mode_of_enquiry = item.modeOfEnquiry;
    if ('otherTerms' in item) mapped.other_terms = item.otherTerms;
    if ('paymentTerms' in item) mapped.payment_terms = item.paymentTerms;
    if ('preparedBy' in item) mapped.prepared_by = item.preparedBy;
    if ('gstAdded' in item) mapped.gst_added = item.gstAdded;
    if ('hsnCode' in item) mapped.hsn_code = item.hsnCode;
    
    // Map remaining quotation fields that Supabase expects
    // IMPORTANT: Details is a JSON array - Supabase stores it as JSON automatically
    if ('details' in item) mapped.details = item.details;
    if ('comments' in item) mapped.comments = item.comments;
    if ('status' in item) mapped.status = item.status;
    
    // For Product fields
    if ('partNo' in item) mapped.part_no = item.partNo;
    if ('description' in item) mapped.description = item.description;
    if ('hsnCode' in item && tableName !== 'quotations') mapped.hsn_code = item.hsnCode;
    if ('prices' in item) mapped.prices = item.prices;
    if ('uom' in item) mapped.uom = item.uom;
    if ('plant' in item) mapped.plant = item.plant;
    if ('weight' in item) mapped.weight = item.weight;
    
    // For Customer fields
    if ('name' in item && tableName === 'customers') mapped.name = item.name;
    if ('address' in item) mapped.address = item.address;
    if ('city' in item) mapped.city = item.city;
    if ('pincode' in item) mapped.pincode = item.pincode;
    if ('discountStructure' in item) mapped.discount_structure = item.discountStructure;

    return mapped;
};

export async function get(tableName: TableName): Promise<any[]> {
    if (!supabase) throw new Error("Supabase client not initialized");

    const supabaseTableName = toSupabaseTableName(tableName);
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const to = from + pageSize - 1;
        let query = supabase.from(supabaseTableName).select('*').range(from, to);

        if (tableName === 'users') {
            query = query.order('name', { ascending: true });
        } else {
            if (tableName !== 'stockStatements' && tableName !== 'pendingSOs') {
                query = query.order('id', { ascending: true });
            }
        }

        const { data, error } = await query;

        if (error) {
            console.error(`Error fetching range ${from}-${to} for ${tableName}:`, JSON.stringify(error, null, 2));
            throw new Error(parseSupabaseError(error, `Failed to fetch data for ${tableName}`));
        }

        if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (data.length < pageSize) {
                hasMore = false;
            } else {
                from += pageSize;
            }
        } else {
            hasMore = false;
        }
    }

    console.log(`[get] Loaded ${allData.length} records from '${tableName}'`);

    // Map back from Supabase snake_case to camelCase for specific tables if needed
    if (tableName === 'pendingSOs' && allData.length > 0) {
        return allData.map((item: any) => ({
            id: item.id,
            date: item.date,
            orderNo: item.order_no,
            partyName: item.party_name,
            itemName: item.item_name,
            materialCode: item.material_code,
            partNo: item.part_no,
            orderedQty: item.ordered_qty,
            balanceQty: item.balance_qty,
            rate: item.rate,
            discount: item.discount,
            value: item.value,
            dueOn: item.due_on
        }));
    }

    if (tableName === 'quotations' && allData.length > 0) {
        return allData.map((item: any) => ({
            id: item.id,
            quotationDate: item.quotation_date,
            enquiryDate: item.enquiry_date,
            customerId: item.customer_id,
            contactPerson: item.contact_person,
            contactNumber: item.contact_number,
            otherTerms: item.other_terms,
            paymentTerms: item.payment_terms,
            preparedBy: item.prepared_by,
            productsBrand: item.products_brand,
            salesPersonId: item.sales_person_id,
            modeOfEnquiry: item.mode_of_enquiry,
            status: item.status,
            comments: item.comments,
            details: item.details,
            gstAdded: item.gst_added
        }));
    }

    return allData;
}

/** Returns the exact row count from Supabase for a given table (ignores RLS row limits). */
export async function countRecords(tableName: TableName): Promise<number> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const supabaseTableName = toSupabaseTableName(tableName);
    const { count, error } = await supabase
        .from(supabaseTableName)
        .select('*', { count: 'exact', head: true });
    if (error) throw new Error(parseSupabaseError(error, `Failed to count ${tableName}`));
    return count ?? 0;
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

export async function set<T extends { id?: number | string, name?: string }>(tableName: TableName, previousData: T[] | null, newData: T[]): Promise<T[] | null> {
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

    // --- Detect deletions (DISABLED to prevent accidental data loss in multi-user environments) ---
    /*
    let toDelete: (string | number)[] = [];
    for (const key of previousDataMap.keys()) {
        if (!newDataMap.has(key)) {
            toDelete.push(key);
        }
    }

    if (isUuidTable) {
        const originalCount = toDelete.length;
        toDelete = toDelete.filter(key => isUuid(key));
    }

    if (toDelete.length > 0) {
        const BATCH_SIZE = 20;
        for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = toDelete.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(supabaseTableName).delete().in(primaryKey, batch);
            if (error) throw new Error(parseSupabaseError(error, `Failed to delete batch from ${supabaseTableName}`));
        }
    }
    */

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
        let allUpsertedData: T[] = [];
        
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

            const { data, error } = await supabase.from(supabaseTableName).upsert(mappedBatch, { onConflict: primaryKey }).select();
            
            if (error) {
                console.error(`Supabase Upsert Error [${supabaseTableName}]:`, error);
                throw new Error(parseSupabaseError(error, `Failed to save to ${supabaseTableName}`));
            }

            // CRITICAL CHECK: In some Supabase RLS configurations, upsert returns success but 0 rows if unauthorized.
            if (!data || data.length === 0) {
                 const failureMsg = `Supabase error [${supabaseTableName}]: Upsert succeeded but returned 0 records. This is likely an RLS (Row-Level Security) permission issue. Please check your Supabase table permissions.`;
                 console.error(failureMsg);
                 throw new Error(failureMsg);
            }

            allUpsertedData = [...allUpsertedData, ...data];
        }
        
        return allUpsertedData as T[];
    }
    return null;
}

// --- Specific Helper Functions ---

export async function getCustomersPaginated(options: any) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    const offset = startAfterDoc || 0;

    let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageLimit - 1);

    if (filters.name) query = query.ilike('name', `%${filters.name}%`);
    if (filters.city) query = query.ilike('city', `%${filters.city}%`);
    if (filters.salesPersonId) query = query.eq('salesPersonId', filters.salesPersonId);

    const { data, error, count } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch customers"));
    return { customers: (data || []) as Customer[], count: count || 0 };
}

export async function searchCustomers(term: string) {
    if (!supabase) throw new Error("Supabase client not initialized");
    let query = supabase.from('customers').select('*').limit(50);
    if (term) query = query.ilike('name', `%${term}%`);
    else query = query.order('id', { ascending: false });
    const { data, error } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to search customers"));
    return (data || []) as Customer[];
}

export async function getCustomersByIds(ids: number[]) {
    if (!supabase) return [];
    if (!ids || ids.length === 0) return [];
    
    const BATCH_SIZE = 100;
    const allCustomers: Customer[] = [];
    
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.from('customers').select('*').in('id', batch);
        if (error) throw new Error(parseSupabaseError(error, "Failed to fetch customers by IDs"));
        if (data) {
            allCustomers.push(...(data as Customer[]));
        }
    }
    
    return allCustomers;
}

export async function upsertCustomer(customer: any) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').upsert(customer, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, 'Failed to upsert customer'));
}

export async function deleteCustomer(id: number) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw new Error(parseSupabaseError(error, 'Failed to delete customer'));
}

export async function addCustomersBatch(customers: any[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').upsert(customers, { onConflict: 'id' });
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
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageLimit - 1);

    if (filters.universal) {
        const cleanInput = filters.universal.replace(/[\s,.-]/g, '');
        if (cleanInput.length > 0) {
            const fuzzyTerm = cleanInput.split('').join('%');
            const pattern = `%${fuzzyTerm}%`;
            query = query.or(`partNo.ilike."${pattern}",description.ilike."${pattern}"`);
        } else {
            const pattern = `%${filters.universal}%`;
            query = query.or(`partNo.ilike."${pattern}",description.ilike."${pattern}"`);
        }
    } else {
        if (filters.partNo) {
            const terms = filters.partNo.split('*').map((term: string) => term.trim()).filter(Boolean);
            if (terms.length > 0) {
                const orFilter = terms.map((term: string) => `partNo.ilike."*${term.replace(/"/g, '""')}*"`).join(',');
                query = query.or(orFilter);
            }
        }
        if (filters.description) {
            const terms = filters.description.split('*').map((term: string) => term.trim()).filter(Boolean);
            if (terms.length > 0) {
                const orFilter = terms.map((term: string) => `description.ilike."*${term.replace(/"/g, '""')}*"`).join(',');
                query = query.or(orFilter);
            }
        }
    }

    const { data, error } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products"));
    const products = (data || []) as Product[];
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
        allProducts.push(...(data as Product[]));
        if (data.length < limit) break;
        from += limit;
    }
    return allProducts;
}

export async function addProductsBatch(products: any[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('products').upsert(products, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, "Failed to add products batch"));
}

export async function deleteProductsBatch(ids: number[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('products').delete().in('id', ids);
    if (error) throw new Error(parseSupabaseError(error, "Failed to delete products batch"));
}

export async function updateProduct(product: any) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { id, ...productData } = product;
    const { error } = await supabase.from('products').update(productData).eq('id', id);
    if (error) throw new Error(parseSupabaseError(error, "Failed to update product"));
}

export async function searchProducts(term: string) {
    if (!supabase) throw new Error("Supabase client not initialized");
    let query = supabase.from('products').select('*').limit(50);
    if (term) {
        const terms = term.split('*').map(t => t.trim().replace(/"/g, '""')).filter(Boolean);
        if (terms.length > 0) {
            const partNoFilters = terms.map(t => `partNo.ilike."*${t}*"`).join(',');
            const descriptionFilters = terms.map(t => `description.ilike."*${t}*"`).join(',');
            query = query.or(`${partNoFilters},${descriptionFilters}`);
        }
    } else {
        query = query.order('id', { ascending: false });
    }
    const { data, error } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to search products"));

    const products = (data || []) as Product[];

    // Sort by effective current price ascending (LP preferred, fallback SP).
    // Products with no price are pushed to the end.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getEffectivePrice = (product: Product): number => {
        if (!product.prices || product.prices.length === 0) return Infinity;
        const active = product.prices.find(p => {
            const from = new Date(p.validFrom); from.setHours(0,0,0,0);
            const to   = new Date(p.validTo);   to.setHours(23,59,59,999);
            return today >= from && today <= to;
        });
        const entry = active
            ?? [...product.prices].filter(p => new Date(p.validFrom) <= today)
                                  .sort((a,b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime())[0]
            ?? [...product.prices].sort((a,b) => new Date(a.validFrom).getTime() - new Date(b.validFrom).getTime())[0];
        if (!entry) return Infinity;
        const price = entry.lp > 0 ? entry.lp : entry.sp;
        return price > 0 ? price : Infinity;
    };

    return products.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
}


export async function getProductsByIds(ids: number[]) {
    if (!supabase) return [];
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase.from('products').select('*').in('id', ids);
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products by IDs"));
    return (data || []) as Product[];
}

export async function getProductsByPartNos(partNos: string[]) {
    if (!supabase) return [];
    if (!partNos || partNos.length === 0) return [];
    const distinctPartNos = [...new Set(partNos)];
    const { data, error } = await supabase.from('products').select('*').in('partNo', distinctPartNos);
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products by Part Nos"));
    return (data || []) as Product[];
}
