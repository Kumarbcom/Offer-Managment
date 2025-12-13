
import { supabase } from './supabaseClient';
import type { Customer, Product } from './types';

type TableName = 'salesPersons' | 'customers' | 'products' | 'quotations' | 'users' | 'deliveryChallans' | 'stockStatements' | 'pendingSOs';

const parseSupabaseError = (error: unknown, context?: string): string => {
  const prefix = context ? `${context}: ` : '';
  try {
      if (typeof error === 'object' && error !== null) {
        const err = error as any;
        // Check for specific Supabase error properties
        if (err.message) return `${prefix}${err.message}${err.details ? ' - ' + err.details : ''}${err.hint ? ' (' + err.hint + ')' : ''}`;
        
        // Fallback to JSON stringify for unknown objects to avoid [object Object]
        return `${prefix}${JSON.stringify(err)}`;
      }
      return `${prefix}${String(error)}`;
  } catch (e) {
      return `${prefix}Unknown error (failed to parse original error)`;
  }
};

export const toSupabaseTableName = (name: TableName): string => {
    // Maps internal collection names to the Supabase table names.
    // PostgreSQL tables are usually snake_case.
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

export async function get(tableName: TableName): Promise<any[]> {
    if (!supabase) throw new Error("Supabase client not initialized");
    
    const supabaseTableName = toSupabaseTableName(tableName);
    
    let query = supabase.from(supabaseTableName).select('*');

    if (tableName === 'users') {
        query = query.order('name', { ascending: true });
    } else {
        // Most tables have an ID.
        // For stock/pending, we try to order by ID if it exists, otherwise Supabase might return default order.
        // We'll wrap this in a way that doesn't crash if 'id' column is missing, 
        // though standard tables here should have it.
        if (tableName !== 'stockStatements' && tableName !== 'pendingSOs') {
             query = query.order('id', { ascending: false });
        }
    }

    const { data, error } = await query;
    
    if (error) {
        console.error(`Error fetching ${tableName} (${supabaseTableName}):`, JSON.stringify(error, null, 2));
        throw new Error(parseSupabaseError(error, `Failed to fetch data for ${tableName}`));
    }
    return data || [];
}

export async function set<T extends { id?: number | string, name?: string }>(tableName: TableName, previousData: T[] | null, newData: T[]): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");

    const supabaseTableName = toSupabaseTableName(tableName);
    const primaryKey = tableName === 'users' ? 'name' : 'id';

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
    const toDelete: (string | number)[] = [];
    for (const key of previousDataMap.keys()) {
        if (!newDataMap.has(key)) {
            toDelete.push(key);
        }
    }

    if (toDelete.length > 0) {
        const BATCH_SIZE = 1000;
        for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = toDelete.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(supabaseTableName).delete().in(primaryKey, batch);
            if (error) throw new Error(parseSupabaseError(error, `Failed to delete batch from ${supabaseTableName}`));
        }
    }

    // Detect Upserts (New or Changed)
    const toUpsert: T[] = [];
    for (const [key, newItem] of newDataMap.entries()) {
        const prevItem = previousDataMap.get(key);
        if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(newItem)) {
            toUpsert.push(newItem);
        }
    }

    if (toUpsert.length > 0) {
        const BATCH_SIZE = 1000;
        for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
            let batch = toUpsert.slice(i, i + BATCH_SIZE);

            // FIX: If table is 'stockStatements', remove the 'value' property before upserting
            // because it is a GENERATED ALWAYS column in the database (quantity * rate).
            // Attempting to write to it causes an error.
            if (tableName === 'stockStatements') {
                batch = batch.map(item => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { value, ...rest } = item as any;
                    return rest as T;
                });
            }

            const { error } = await supabase.from(supabaseTableName).upsert(batch, { onConflict: primaryKey });
            if (error) throw new Error(parseSupabaseError(error, `Failed to upsert batch to ${supabaseTableName}`));
        }
    }
}

// --- Specific Helper Functions ---
// NOTE: We must use the exact table names as recognized by Supabase (Postgres is usually lowercase).

export async function getCustomersPaginated(options: any) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    const offset = startAfterDoc || 0;

    let query = supabase
        .from('customers') // Fixed: Lowercase
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
    let query = supabase.from('customers').select('*').limit(50); // Fixed: Lowercase
    if (term) query = query.ilike('name', `%${term}%`);
    else query = query.order('id', { ascending: false });
    const { data, error } = await query;
    if (error) throw new Error(parseSupabaseError(error, "Failed to search customers"));
    return (data || []) as Customer[];
}

export async function getCustomersByIds(ids: number[]) { 
    if (!supabase) return [];
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase.from('customers').select('*').in('id', ids); // Fixed: Lowercase
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch customers by IDs"));
    return (data || []) as Customer[];
}

export async function upsertCustomer(customer: any) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').upsert(customer, { onConflict: 'id' }); // Fixed: Lowercase
    if (error) throw new Error(parseSupabaseError(error, 'Failed to upsert customer'));
}

export async function deleteCustomer(id: number) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').delete().eq('id', id); // Fixed: Lowercase
    if (error) throw new Error(parseSupabaseError(error, 'Failed to delete customer'));
}

export async function addCustomersBatch(customers: any[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').upsert(customers, { onConflict: 'id' }); // Fixed: Lowercase
    if (error) throw new Error(parseSupabaseError(error, "Failed to add customers batch"));
}

// Products
export async function getProductsPaginated(options: any) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    const offset = startAfterDoc || 0;

    let query = supabase
        .from('products') // Fixed: Lowercase
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
        const { data, error } = await supabase.from('products').select('*').order('partNo', { ascending: true }).range(from, from + limit - 1); // Fixed: Lowercase
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
    const { error } = await supabase.from('products').upsert(products, { onConflict: 'id' }); // Fixed: Lowercase
    if (error) throw new Error(parseSupabaseError(error, "Failed to add products batch"));
}

export async function deleteProductsBatch(ids: number[]) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('products').delete().in('id', ids); // Fixed: Lowercase
    if (error) throw new Error(parseSupabaseError(error, "Failed to delete products batch"));
}

export async function updateProduct(product: any) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { id, ...productData } = product;
    const { error } = await supabase.from('products').update(productData).eq('id', id); // Fixed: Lowercase
    if (error) throw new Error(parseSupabaseError(error, "Failed to update product"));
}

export async function searchProducts(term: string) { 
    if (!supabase) throw new Error("Supabase client not initialized");
    let query = supabase.from('products').select('*').limit(50); // Fixed: Lowercase
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
    return (data || []) as Product[];
}

export async function getProductsByIds(ids: number[]) { 
    if (!supabase) return [];
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase.from('products').select('*').in('id', ids); // Fixed: Lowercase
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products by IDs"));
    return (data || []) as Product[];
}

export async function getProductsByPartNos(partNos: string[]) { 
    if (!supabase) return [];
    if (!partNos || partNos.length === 0) return [];
    const distinctPartNos = [...new Set(partNos)];
    const { data, error } = await supabase.from('products').select('*').in('partNo', distinctPartNos); // Fixed: Lowercase
    if (error) throw new Error(parseSupabaseError(error, "Failed to fetch products by Part Nos"));
    return (data || []) as Product[];
}
