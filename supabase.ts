import { supabase } from './supabaseClient';
import type { Customer, Product } from './types';

type TableName = 'salesPersons' | 'customers' | 'products' | 'quotations' | 'deliveryChallans' | 'users';

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
    return name;
};


/**
 * Fetches all documents from a specified Supabase table.
 * @param tableName The name of the table to fetch.
 * @returns A promise that resolves to an array of documents.
 */
export async function get(tableName: TableName): Promise<any[]> {
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
    const supabaseTableName = toSupabaseTableName(tableName);
    const primaryKey = tableName === 'users' ? 'name' : 'id';

    const previousDataMap = new Map<string | number, T>();
    if (previousData) {
        previousData.forEach(item => {
            // FIX: Explicitly access `item.name` or `item.id` to help TypeScript infer the correct type.
            // The original `item[primaryKey as keyof T]` was too generic for the compiler to narrow down.
            const key = primaryKey === 'name' ? item.name : item.id;
            if (key !== undefined) {
                previousDataMap.set(key, item);
            }
        });
    }

    const newDataMap = new Map<string | number, T>();
    newData.forEach(item => {
        // FIX: Explicitly access `item.name` or `item.id` to help TypeScript infer the correct type.
        // The original `item[primaryKey as keyof T]` was too generic for the compiler to narrow down.
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
        const { error } = await supabase.from(supabaseTableName).delete().in(primaryKey, toDelete);
        if (error) {
            throw new Error(parseSupabaseError(error, `Failed to delete data from ${supabaseTableName}`));
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
        const { error } = await supabase.from(supabaseTableName).upsert(toUpsert, { onConflict: primaryKey });
        if (error) {
            throw new Error(parseSupabaseError(error, `Failed to upsert data to ${supabaseTableName}`));
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
    };
}

export async function getCustomersPaginated(options: CustomerQueryOptions) {
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

    const { data, error, count } = await query;
    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to fetch customers"));
    }
    
    return { customers: (data || []) as Customer[], count: count || 0 };
}

export async function searchCustomers(term: string): Promise<Customer[]> {
    if (!term) return [];
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .ilike('name', `%${term}%`)
        .limit(50);

    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to search customers"));
    }
    return (data || []) as Customer[];
}

export async function getCustomersByIds(ids: number[]): Promise<Customer[]> {
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
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
  
    if (error) {
      throw new Error(parseSupabaseError(error, "Failed to fetch customer stats"));
    }
    return { totalCount: count || 0 };
}

export async function upsertCustomer(customer: Omit<Customer, 'id'> | Customer) {
    const { error } = await supabase.from('customers').upsert(customer, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, 'Failed to upsert customer'));
}

export async function deleteCustomer(id: number) {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw new Error(parseSupabaseError(error, 'Failed to delete customer'));
}

export async function addCustomersBatch(customers: Customer[]): Promise<void> {
    const { error } = await supabase.from('customers').insert(customers);
    if (error) throw new Error(parseSupabaseError(error, "Failed to add customers batch"));
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
    };
}

export async function getProductsPaginated(options: ProductQueryOptions) {
    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    
    const offset = startAfterDoc || 0;

    let query = supabase
        .from('products')
        .select('*')
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageLimit - 1);
    
    if (filters.partNo) {
        query = query.ilike('partNo', `${filters.partNo}%`);
    }
    if (filters.description) {
        query = query.ilike('description', `${filters.description}%`);
    }

    const { data, error } = await query;
    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to fetch products"));
    }
    
    const products = (data || []) as Product[];
    const lastVisibleDoc = offset + products.length; // The next offset

    return { products, lastVisibleDoc };
}


export async function addProductsBatch(products: Product[]): Promise<void> {
    const { error } = await supabase.from('products').upsert(products, { onConflict: 'id' });
    if (error) throw new Error(parseSupabaseError(error, "Failed to add products batch"));
}

export async function deleteProductsBatch(productIds: number[]): Promise<void> {
    const { error } = await supabase.from('products').delete().in('id', productIds);
    if (error) throw new Error(parseSupabaseError(error, "Failed to delete products batch"));
}

export async function updateProduct(product: Product): Promise<void> {
    const { id, ...productData } = product;
    const { error } = await supabase.from('products').update(productData).eq('id', id);
    if (error) throw new Error(parseSupabaseError(error, "Failed to update product"));
}

export async function searchProducts(term: string) {
    if (!term) return [];
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`partNo.ilike.%${term}%,description.ilike.%${term}%`)
        .limit(50);

    if (error) {
        throw new Error(parseSupabaseError(error, "Failed to search products"));
    }
    return (data || []) as Product[];
}

export async function getProductsByIds(ids: number[]) {
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