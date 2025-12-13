
import { supabase } from './supabaseClient';
import type { Customer, Product } from './types';

type TableName = 'salesPersons' | 'customers' | 'products' | 'quotations' | 'users' | 'deliveryChallans' | 'stockStatements' | 'pendingSOs';

const parseSupabaseError = (error: unknown, context?: string): string => {
  const prefix = context ? `${context}: ` : '';
  if (typeof error === 'object' && error !== null) {
    const supabaseError = error as any;
    let errorMessage = supabaseError.message || JSON.stringify(error);
    if (supabaseError.details) errorMessage += `\nDetails: ${supabaseError.details}`;
    if (supabaseError.hint) errorMessage += `\nHint: ${supabaseError.hint}`;
    return `${prefix}${errorMessage}`;
  }
  return `${prefix}${String(error)}`;
};

// This function maps the app's internal camelCase names to the snake_case convention used by Supabase tables.
export const toSupabaseTableName = (name: TableName): string => {
    if (name === 'salesPersons') return 'sales_persons';
    if (name === 'deliveryChallans') return 'delivery_challans';
    if (name === 'stockStatements') return 'stock_statements';
    if (name === 'pendingSOs') return 'pending_sos';
    return name;
};


/**
 * Fetches all documents from a specified Supabase table.
 * @param tableName The name of the table to fetch.
 * @returns A promise that resolves to an array of documents.
 */
export async function get(tableName: TableName): Promise<any[]> {
    if (!supabase) throw new Error("Supabase client not initialized");
    
    const supabaseTableName = toSupabaseTableName(tableName);
    const { data, error } = await supabase.from(supabaseTableName).select('*');
    if (error) {
        throw new Error(parseSupabaseError(error, `Failed to fetch data for ${tableName} (from table: ${supabaseTableName})`));
    }
    return data || [];
}

/**
 * Efficiently synchronizes a local array of data with a Supabase table.
 * It calculates the difference between the previous and new state and performs only the necessary create, update, or delete operations.
 * @param tableName The name of the table to update.
 * @param previousData The state of the data before the change.
 * @param newData The new array of data that represents the desired state of the collection.
 */
export async function set<T extends { id?: number, name?: string }>(tableName: TableName, previousData: T[] | null, newData: T[]): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");

    const supabaseTableName = toSupabaseTableName(tableName);
    const primaryKey = tableName === 'users' ? 'name' : 'id';

    const previousDataMap = new Map<string | number, T>();
    if (previousData) {
        previousData.forEach(item => {
            const key = primaryKey === 'name' ? item.name : item.id;
            if (key !== undefined) {
                previousDataMap.set(key, item);
            }
        });
    }

    const newDataMap = new Map<string | number, T>();
    newData.forEach(item => {
        const key = primaryKey === 'name' ? item.name : item.id;
        if (key !== undefined) {
            newDataMap.set(key, item);
        }
    });

    const toDelete: (string | number)[] = [];
    for (const key of previousDataMap.keys()) {
        if (!newDataMap.has(key)) {
            toDelete.push(key);
        }
    }

    if (toDelete.length > 0) {
        // Supabase query filters have limits (e.g. URL length or complexity). Batch deletes to be safe.
        const BATCH_SIZE = 1000;
        for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            const batch = toDelete.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(supabaseTableName).delete().in(primaryKey, batch);
            if (error) {
                throw new Error(parseSupabaseError(error, `Failed to delete data from ${supabaseTableName} (Batch ${Math.floor(i/BATCH_SIZE) + 1})`));
            }
        }
    }

    const toUpsert: T[] = [];
    for (const [key, newItem] of newDataMap.entries()) {
        const prevItem = previousDataMap.get(key);
        if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(newItem)) {
            toUpsert.push(newItem);
        }
    }

    if (toUpsert.length > 0) {
        // Supabase upsert has a limit on payload size. For bulk uploads, we should batch.
        const BATCH_SIZE = 1000;
        for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
            const batch = toUpsert.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(supabaseTableName).upsert(batch, { onConflict: primaryKey });
            if (error) {
                throw new Error(parseSupabaseError(error, `Failed to upsert data to ${supabaseTableName} (Batch ${Math.floor(i/BATCH_SIZE) + 1})`));
            }
        }
    }
}

// --- New Scalable Functions for Customers ---

interface CustomerQueryOptions {
    pageLimit: number;
    startAfterDoc: number; // offset
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    filters: {
        name?: string;
        city?: string;
        salesPersonId?: number;
    };
}

export async function getCustomersPaginated(options: CustomerQueryOptions) {
    if (!supabase) throw new Error("Supabase client not initialized");

    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    
    const offset = startAfterDoc || 0;

    let query = supabase
        .from('customers')
        .select('*', { count: 'exact' }) // Get total count
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageLimit - 1);
    
    if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`);
    }
    if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`);
    }
    if (filters.salesPersonId) {
        query = query.eq('salesPersonId', filters.salesPersonId);
    }

    const { data, error, count } = await query;
    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to fetch customers"));
    }
    
    return { customers: (data || []) as Customer[], count: count || 0 };
}

export async function searchCustomers(term: string): Promise<Customer[]> {
    if (!supabase) throw new Error("Supabase client not initialized");

    let query = supabase.from('customers').select('*').limit(50);
    if (term) {
        query = query.ilike('name', `%${term}%`);
    } else {
        query = query.order('id', { ascending: false }); // Show latest customers by default
    }
    const { data, error } = await query;

    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to search customers"));
    }
    return (data || []) as Customer[];
}

export async function getCustomersByIds(ids: number[]): Promise<Customer[]> {
    if (!supabase) return []; // Fail silently or return empty
    if (!ids || ids.length === 0) return [];
    
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .in('id', ids);
    
    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to fetch customers by IDs"));
    }
    return (data || []) as Customer[];
}

export async function getCustomerStats() {
    if (!supabase) throw new Error("Supabase client not initialized");

    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
  
    if (error) {
      throw new Error(parseSupabaseError(error, "Failed to fetch customer stats"));
    }
    return { totalCount: count || 0 };
}

export async function upsertCustomer(customer: Omit<Customer, 'id'> | Customer) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').upsert(customer, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, 'Failed to upsert customer'));
}

export async function deleteCustomer(id: number) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw new Error(parseSupabaseError(error, 'Failed to delete customer'));
}

export async function addCustomersBatch(customers: Customer[]): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('customers').upsert(customers, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, "Failed to add or update customers batch"));
}


// --- Scalable Functions for Products ---

interface ProductQueryOptions {
    pageLimit: number;
    startAfterDoc: number; // For Supabase, this is the offset.
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    filters: {
        partNo?: string;
        description?: string;
        universal?: string;
    };
}

export async function getProductsPaginated(options: ProductQueryOptions) {
    if (!supabase) throw new Error("Supabase client not initialized");

    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    
    const offset = startAfterDoc || 0;

    let query = supabase
        .from('products')
        .select('*')
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageLimit - 1);
    
    if (filters.universal) {
        // Fuzzy search: Remove spaces/punctuation and interleave with %
        // e.g., "3 G 2.5" -> "3G25" -> "%3%G%2%5%"
        // This matches "3G2.5", "3G2,5", "3 G 2.5" etc.
        const cleanInput = filters.universal.replace(/[\s,.-]/g, '');
        if (cleanInput.length > 0) {
            const fuzzyTerm = cleanInput.split('').join('%');
            const pattern = `%${fuzzyTerm}%`;
            query = query.or(`partNo.ilike."${pattern}",description.ilike."${pattern}"`);
        } else {
             // If user typed only spaces or punctuation, try standard contains on raw term
             const pattern = `%${filters.universal}%`;
             query = query.or(`partNo.ilike."${pattern}",description.ilike."${pattern}"`);
        }
    } else {
        if (filters.partNo) {
            const terms = filters.partNo.split('*').map(term => term.trim()).filter(Boolean);
            if (terms.length > 0) {
                const orFilter = terms.map(term => `partNo.ilike."*${term.replace(/"/g, '""')}*"`).join(',');
                query = query.or(orFilter);
            }
        }
        if (filters.description) {
            const terms = filters.description.split('*').map(term => term.trim()).filter(Boolean);
            if (terms.length > 0) {
                const orFilter = terms.map(term => `description.ilike."*${term.replace(/"/g, '""')}*"`).join(',');
                query = query.or(orFilter);
            }
        }
    }

    const { data, error } = await query;
    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to fetch products"));
    }
    
    const products = (data || []) as Product[];
    const lastVisibleDoc = offset + products.length; // The next offset

    return { products, lastVisibleDoc };
}

export async function fetchAllProductsForExport() {
    if (!supabase) throw new Error("Supabase client not initialized");

    let allProducts: Product[] = [];
    let from = 0;
    const limit = 1000;
    
    while (true) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('partNo', { ascending: true })
            .range(from, from + limit - 1);

        if (error) {
            throw new Error(parseSupabaseError(error, "Failed to fetch all products for export"));
        }
        
        if (!data || data.length === 0) {
            break;
        }
        
        allProducts.push(...(data as Product[]));
        
        if (data.length < limit) {
            break;
        }
        
        from += limit;
    }
    
    return allProducts;
}


export async function addProductsBatch(products: Product[]): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('products').upsert(products, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, "Failed to add products batch"));
}

export async function deleteProductsBatch(productIds: number[]): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase.from('products').delete().in('id', productIds);
    if (error) throw new Error(parseSupabaseError(error, "Failed to delete products batch"));
}

export async function updateProduct(product: Product): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { id, ...productData } = product;
    const { error } = await supabase.from('products').update(productData).eq('id', id);
    if (error) throw new Error(parseSupabaseError(error, "Failed to update product"));
}

export async function searchProducts(term: string) {
    if (!supabase) throw new Error("Supabase client not initialized");

    let query = supabase
        .from('products')
        .select('*')
        .limit(50);
    
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

    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to search products"));
    }
    return (data || []) as Product[];
}

export async function getProductsByIds(ids: number[]) {
    if (!supabase) return [];
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('id', ids);
    
    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to fetch products by IDs"));
    }
    return (data || []) as Product[];
}

export async function getProductsByPartNos(partNos: string[]) {
    if (!supabase) return [];
    if (!partNos || partNos.length === 0) return [];
    // Only query distinct part numbers to optimize
    const distinctPartNos = [...new Set(partNos)];
    
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('partNo', distinctPartNos);
        
    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to fetch products by Part Nos"));
    }
    return (data || []) as Product[];
}
