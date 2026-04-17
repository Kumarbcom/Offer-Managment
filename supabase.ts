
import { supabase } from './supabaseClient';
import type { Customer, Product, Quotation } from './types';

type TableName = 'salesPersons' | 'customers' | 'products' | 'quotations' | 'users' | 'deliveryChallans' | 'stockStatements' | 'pendingSOs' | 'settings';

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
        case 'settings': return 'settings';
        default: return (name as string).toLowerCase();
    }
};

const mapSortBy = (tableName: TableName, sortBy: string): string => {
    if (tableName === 'customers') {
        switch (sortBy) {
            case 'gstNo': return 'gst_no';
            case 'contactPerson': return 'contact_person';
            case 'contactNumber': return 'contact_number';
            case 'salesPersonId': return 'sales_person_id';
            case 'discountStructure': return 'discount_structure';
            default: return sortBy;
        }
    }
    if (tableName === 'products') {
        switch (sortBy) {
            case 'partNo': return 'partNo';
            case 'hsnCode': return 'hsnCode';
            default: return sortBy;
        }
    }
    return sortBy;
};

const getPrimaryKey = (tableName: TableName): string => {
    if (tableName === 'users') return 'name';
    if (tableName === 'settings') return 'key';
    return 'id';
};

const formatSearchPattern = (term: string): string => {
    if (!term) return '%';
    const clean = term.trim().replace(/\*/g, '%');
    return clean.includes('%') ? clean : `%${clean}%`;
};

export const mapToSupabase = (tableName: TableName, item: any) => {
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
    if (tableName === 'quotations') {
        return {
            id: item.id,
            quotation_date: item.quotationDate,
            enquiry_date: item.enquiryDate,
            customer_id: item.customerId,
            contact_person: item.contactPerson,
            contact_number: item.contactNumber,
            other_terms: item.otherTerms,
            payment_terms: item.paymentTerms,
            prepared_by: item.preparedBy,
            products_brand: item.productsBrand,
            sales_person_id: item.salesPersonId,
            mode_of_enquiry: item.modeOfEnquiry,
            status: item.status,
            comments: item.comments,
            is_gst_included: item.isGstIncluded,
            details: item.details
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
    if (tableName === 'customers') {
        return {
            id: item.id,
            name: item.name,
            address: item.address,
            city: item.city,
            pincode: item.pincode,
            gst_no: item.gstNo,
            contact_person: item.contactPerson,
            contact_number: item.contactNumber,
            email: item.email,
            sales_person_id: item.salesPersonId,
            discount_structure: item.discountStructure
        };
    }
    if (tableName === 'products') {
        return {
            id: item.id,
            partNo: item.partNo,
            description: item.description,
            hsnCode: item.hsnCode,
            prices: item.prices,
            uom: item.uom,
            plant: item.plant,
            weight: item.weight
        };
    }
    if (tableName === 'deliveryChallans') {
        return {
            id: item.id,
            challan_no: item.challanNo,
            challan_date: item.challanDate,
            quotation_id: item.quotationId,
            customer_id: item.customerId,
            contact_person: item.contactPerson,
            contact_number: item.contactNumber,
            details: item.details,
            status: item.status,
            prepared_by: item.preparedBy,
            comments: item.comments
        };
    }
    if (tableName === 'stockStatements') {
        return {
            id: item.id,
            part_no: item.partNo,
            description: item.description,
            stock_qty: item.stockQty,
            uom: item.uom
        };
    }
    return item;
};

export const mapFromSupabase = (tableName: TableName, item: any) => {
    if (tableName === 'pendingSOs') {
        return {
            id: item.id,
            date: item.date,
            orderNo: item.order_no || item.orderNo,
            partyName: item.party_name || item.partyName,
            itemName: item.item_name || item.itemName,
            materialCode: item.material_code || item.materialCode,
            partNo: item.part_no || item.partNo,
            orderedQty: item.ordered_qty || item.orderedQty,
            balanceQty: item.balance_qty || item.balanceQty,
            rate: item.rate,
            discount: item.discount,
            value: item.value,
            dueOn: item.due_on || item.dueOn
        };
    }
    if (tableName === 'quotations') {
        const rawDate = item.quotation_date || item.quotationDate || item.date || item.created_at || '';
        let quotationDate = '';
        if (rawDate) {
            try {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    quotationDate = d.toISOString().split('T')[0];
                } else if (typeof rawDate === 'string' && rawDate.match(/^\d{4}-\d{2}-\d{2}/)) {
                    quotationDate = rawDate.substring(0, 10);
                }
            } catch (e) {
                quotationDate = '';
            }
        }
        
        const rawEnquiryDate = item.enquiry_date || item.enquiryDate || '';
        let enquiryDate = '';
        if (rawEnquiryDate) {
            try {
                const d = new Date(rawEnquiryDate);
                if (!isNaN(d.getTime())) {
                    enquiryDate = d.toISOString().split('T')[0];
                } else if (typeof rawEnquiryDate === 'string' && rawEnquiryDate.match(/^\d{4}-\d{2}-\d{2}/)) {
                    enquiryDate = rawEnquiryDate.substring(0, 10);
                }
            } catch (e) {
                enquiryDate = '';
            }
        }

        return {
            id: item.id,
            quotationDate,
            enquiryDate,
            customerId: item.customer_id !== undefined && item.customer_id !== null ? Number(item.customer_id) : (item.customerId !== undefined && item.customerId !== null ? Number(item.customerId) : null),
            contactPerson: item.contact_person || item.contactPerson || '',
            contactNumber: item.contact_number || item.contactNumber || '',
            otherTerms: item.other_terms || item.otherTerms || '',
            paymentTerms: item.payment_terms || item.paymentTerms || '',
            preparedBy: item.prepared_by || item.preparedBy || '',
            productsBrand: item.products_brand || item.productsBrand || '',
            salesPersonId: item.sales_person_id !== undefined && item.sales_person_id !== null ? Number(item.sales_person_id) : (item.salesPersonId !== undefined && item.salesPersonId !== null ? Number(item.salesPersonId) : (item.sales_person !== undefined && item.sales_person !== null ? Number(item.sales_person) : null)),
            modeOfEnquiry: item.mode_of_enquiry || item.modeOfEnquiry || '',
            status: item.status || 'Open',
            comments: item.comments || '',
            isGstIncluded: item.is_gst_included || item.isGstIncluded || false,
            details: item.details || []
        };
    }
    if (tableName === 'salesPersons') {
        return {
            id: item.id,
            name: item.name,
            email: item.email,
            mobile: item.mobile || item.mobile_no || ''
        };
    }
    if (tableName === 'customers') {
        return {
            id: item.id,
            name: item.name,
            address: item.address,
            city: item.city,
            pincode: item.pincode,
            gstNo: item.gst_no || item.gstNo,
            contactPerson: item.contact_person || item.contactPerson,
            contactNumber: item.contact_number || item.contactNumber,
            email: item.email,
            salesPersonId: item.sales_person_id !== undefined && item.sales_person_id !== null ? Number(item.sales_person_id) : (item.salesPersonId !== undefined && item.salesPersonId !== null ? Number(item.salesPersonId) : null),
            discountStructure: item.discount_structure || item.discountStructure
        };
    }
    if (tableName === 'products') {
        return {
            id: item.id,
            partNo: item.partNo || item.part_no,
            description: item.description,
            hsnCode: item.hsnCode || item.hsn_code,
            prices: item.prices,
            uom: item.uom,
            plant: item.plant,
            weight: item.weight
        };
    }
    if (tableName === 'deliveryChallans') {
        return {
            id: item.id,
            challanNo: item.challan_no || item.challanNo,
            challanDate: item.challan_date || item.challanDate,
            quotationId: item.quotation_id || item.quotationId,
            customerId: item.customer_id || item.customerId,
            contactPerson: item.contact_person || item.contactPerson,
            contactNumber: item.contact_number || item.contactNumber,
            details: item.details,
            status: item.status,
            preparedBy: item.prepared_by || item.preparedBy,
            comments: item.comments
        };
    }
    if (tableName === 'stockStatements') {
        return {
            id: item.id,
            partNo: item.part_no || item.partNo,
            description: item.description,
            stockQty: item.stock_qty || item.stockQty,
            uom: item.uom
        };
    }
    return item;
};

/**
 * Fetches ALL records from a table by exhaustively looping through ranges.
 * This ensures we bypass the default 1000-row safety limit of Supabase/PostgREST.
 */
export async function get(tableName: TableName): Promise<any[]> {
    if (!supabase) throw new Error("Supabase client not initialized");
    
    const supabaseTableName = toSupabaseTableName(tableName);
    let allData: any[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    console.log(`[Supabase] Syncing table: ${tableName}`);

    while (hasMore) {
        const to = from + pageSize - 1;
        
        let query = supabase
            .from(supabaseTableName)
            .select('*')
            .range(from, to);

        // Consistent ordering ensures pagination doesn't skip or duplicate items
        if (tableName === 'users') {
            query = query.order('name', { ascending: true });
        } else {
            query = query.order('id', { ascending: true });
        }

        const { data, error } = await query;
        
        if (error) {
            console.error(`[Supabase] Error fetching range ${from}-${to} for ${tableName}:`, error);
            throw new Error(parseSupabaseError(error, `Fetch failed for ${tableName} [Range: ${from}-${to}]`));
        }

        if (data && data.length > 0) {
            const processedBatch = data.map((item: any) => mapFromSupabase(tableName, item));
            allData = [...allData, ...processedBatch];
            
            console.log(`[Supabase] Fetched batch: ${data.length} records. Total so far: ${allData.length}`);
            
            // If we received exactly the number of items we asked for, there might be more.
            if (data.length === pageSize) {
                from += pageSize;
            } else {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }

    console.log(`[Supabase] Complete. Final count for ${tableName}: ${allData.length}`);
    return allData;
}

export async function clearTable(tableName: TableName): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const supabaseTableName = toSupabaseTableName(tableName);
    const primaryKey = getPrimaryKey(tableName);
    
    const { data, error: fetchError } = await supabase
        .from(supabaseTableName)
        .select(primaryKey);

    if (fetchError) {
        throw new Error(parseSupabaseError(fetchError, `Failed to fetch IDs for clearing ${supabaseTableName}`));
    }

    if (!data || data.length === 0) return;

    const ids = data.map((item: any) => item[primaryKey]);
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

export async function set<T extends { id?: number | string, name?: string, key?: string }>(tableName: TableName, previousData: T[] | null, newData: T[]): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");

    const supabaseTableName = toSupabaseTableName(tableName);
    const primaryKey = getPrimaryKey(tableName);
    const isUuidTable = tableName === 'stockStatements' || tableName === 'pendingSOs';

    const previousDataMap = new Map<string | number, T>();
    if (previousData) {
        previousData.forEach(item => {
            const key = primaryKey === 'name' ? item.name : (primaryKey === 'key' ? item.key : item.id);
            if (key !== undefined) previousDataMap.set(key, item);
        });
    }

    const newDataMap = new Map<string | number, T>();
    newData.forEach(item => {
        const key = primaryKey === 'name' ? item.name : (primaryKey === 'key' ? item.key : item.id);
        if (key !== undefined) newDataMap.set(key, item);
    });

    let toDelete: (string | number)[] = [];
    for (const key of previousDataMap.keys()) {
        if (!newDataMap.has(key)) {
            toDelete.push(key);
        }
    }

    if (isUuidTable) {
        const isUuid = (id: unknown): boolean => {
            if (typeof id !== 'string') return false;
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        };
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

    let toUpsert: T[] = [];
    for (const [key, newItem] of newDataMap.entries()) {
        const prevItem = previousDataMap.get(key);
        if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(newItem)) {
            toUpsert.push(newItem);
        }
    }

    if (toUpsert.length > 0) {
        const BATCH_SIZE = 200;
        for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
            let batch = toUpsert.slice(i, i + BATCH_SIZE);
            const mappedBatch = batch.map(item => {
                let payload = { ...item } as any;
                if (tableName === 'stockStatements') {
                    delete payload.value;
                }
                payload = mapToSupabase(tableName, payload);
                return payload;
            });

            console.log(`[Supabase] Upserting ${mappedBatch.length} items to ${supabaseTableName}:`, mappedBatch);

            const { data, error } = await supabase.from(supabaseTableName).upsert(mappedBatch, { onConflict: primaryKey }).select();
            
            if (error) {
                console.error(`[Supabase] Upsert error for ${supabaseTableName}:`, error);
                throw new Error(parseSupabaseError(error, `Failed to upsert batch to ${supabaseTableName}`));
            }
            
            console.log(`[Supabase] Upsert success for ${supabaseTableName}. Data returned:`, data);
        }
    }
}

export async function purgeQuotationsBeforeDate(date: string) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('quotations').delete().or(`quotation_date.lt.${date},quotationDate.lt.${date}`);
    if (error) throw new Error(parseSupabaseError(error, `Failed to purge quotations before ${date}`));
}

export async function purgeQuotationsBeforeId(id: number) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('quotations').delete().lt('id', id);
    if (error) throw new Error(parseSupabaseError(error, `Failed to purge quotations before ID ${id}`));
}

export async function getCustomersPaginated(options: any) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    const offset = startAfterDoc || 0;

    const supabaseSortBy = mapSortBy('customers', sortBy);

    let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order(supabaseSortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageLimit - 1);
    
    if (filters.name) query = query.ilike('name', formatSearchPattern(filters.name));
    if (filters.city) query = query.ilike('city', formatSearchPattern(filters.city));
    if (filters.salesPersonId) query = query.or(`sales_person_id.eq.${filters.salesPersonId},salesPersonId.eq.${filters.salesPersonId}`);

    const { data, error, count } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch customers"));
    const mappedCustomers = (data || []).map((item: any) => mapFromSupabase('customers', item));
    return { customers: mappedCustomers as Customer[], count: count || 0 };
}

export async function searchCustomers(term: string) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    let query = supabase.from('customers').select('*').limit(50);
    if (term) query = query.ilike('name', formatSearchPattern(term));
    else query = query.order('id', { ascending: false });
    const { data, error } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to search customers"));
    return (data || []).map((item: any) => mapFromSupabase('customers', item)) as Customer[];
}

export async function getCustomersByIds(ids: number[]) { 
    if (!supabase) return [];
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase.from('customers').select('*').in('id', ids);
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch customers by IDs"));
    return (data || []).map((item: any) => mapFromSupabase('customers', item)) as Customer[];
}

export async function upsertCustomer(customer: any) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const mappedCustomer = mapToSupabase('customers', customer);
    const { error } = await supabase.from('customers').upsert(mappedCustomer, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, 'Failed to upsert customer'));
}

export async function deleteCustomer(id: number) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw new Error(parseSupabaseError(error, 'Failed to delete customer'));
}

export async function addCustomersBatch(customers: any[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const mappedCustomers = customers.map(c => mapToSupabase('customers', c));
    const { error } = await supabase.from('customers').upsert(mappedCustomers, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, "Failed to add customers batch"));
}

export async function getProductsPaginated(options: any) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    const offset = startAfterDoc || 0;

    const supabaseSortBy = mapSortBy('products', sortBy);

    let query = supabase
        .from('products')
        .select('id, partNo, description, hsnCode, prices, uom, plant, weight')
        .order(supabaseSortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageLimit - 1);
    
    if (filters.universal) {
        const pattern = formatSearchPattern(filters.universal);
        query = query.or(`partNo.ilike.${pattern},description.ilike.${pattern}`);
    } else {
        if (filters.partNo) {
            query = query.ilike('partNo', formatSearchPattern(filters.partNo));
        }
        if (filters.description) {
            query = query.ilike('description', formatSearchPattern(filters.description));
        }
    }

    const { data, error } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products"));
    const products = (data || []).map((item: any) => mapFromSupabase('products', item)) as Product[];
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
        const mappedBatch = data.map((item: any) => mapFromSupabase('products', item)) as Product[];
        allProducts.push(...mappedBatch);
        if (data.length < limit) break;
        from += limit;
    }
    return allProducts;
}

export async function addProductsBatch(products: any[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const mappedProducts = products.map(p => mapToSupabase('products', p));
    const { error } = await supabase.from('products').upsert(mappedProducts, { onConflict: 'partNo' });
    if (error) throw new Error(parseSupabaseError(error, "Failed to add products batch"));
}

export async function deleteProductsBatch(ids: number[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('products').delete().in('id', ids);
    if (error) throw new Error(parseSupabaseError(error, "Failed to delete products batch"));
}

export async function updateProduct(product: any) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const mappedProduct = mapToSupabase('products', product);
    const { id, ...productData } = mappedProduct;
    const { error } = await supabase.from('products').update(productData).eq('id', id);
    if (error) throw new Error(parseSupabaseError(error, "Failed to update product"));
}

export async function searchProducts(term: string) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    let query = supabase.from('products').select('id, partNo, description, prices, uom, weight').limit(20);
    if (term) {
        const pattern = formatSearchPattern(term);
        query = query.or(`partNo.ilike.${pattern},description.ilike.${pattern}`);
    } else {
        query = query.order('id', { ascending: false });
    }
    const { data, error } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to search products"));
    return (data || []).map((item: any) => mapFromSupabase('products', item)) as Product[];
}

export async function getProductsByIds(ids: number[]) { 
    if (!supabase) return [];
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase.from('products').select('id, partNo, description, hsnCode, prices, uom, plant, weight').in('id', ids);
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products by IDs"));
    return (data || []).map((item: any) => mapFromSupabase('products', item)) as Product[];
}

export async function getProductsByPartNos(partNos: string[]) { 
    if (!supabase) return [];
    if (!partNos || partNos.length === 0) return [];
    const distinctPartNos = [...new Set(partNos)];
    const { data, error } = await supabase.from('products').select('id, partNo, description, hsnCode, prices, uom, plant, weight').in('partNo', distinctPartNos);
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products by Part Nos"));
    return (data || []).map((item: any) => mapFromSupabase('products', item)) as Product[];
}

export async function getSetting(key: string): Promise<string | null> {
    if (!supabase) return null;
    const { data, error } = await supabase.from('settings').select('value').eq('key', key).single();
    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        console.error(`Error fetching setting ${key}:`, error);
        return null;
    }
    return data?.value || null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
    if (!supabase) return;
    if (value === null) {
        await supabase.from('settings').delete().eq('key', key);
    } else {
        const { error } = await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
        if (error) throw new Error(parseSupabaseError(error, `Failed to set setting ${key}`));
    }
}
