import { supabase } from './supabaseClient';
import type { Product } from './types';

export type TableName = 'salesPersons' | 'customers' | 'products' | 'quotations' | 'deliveryChallans' | 'users';

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
        const errorMsg = `Supabase Error (${supabaseTableName}): ${error.message}. Details: ${error.details}. Hint: ${error.hint}`;
        console.error(`Failed to fetch data for ${tableName}:`, error);
        throw new Error(errorMsg);
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
        const { error } = await supabase.from(supabaseTableName).delete().in(primaryKey, toDelete);
        if (error) {
            const errorMsg = `Failed to delete from ${supabaseTableName}: ${error.message}`;
            console.error(errorMsg, error);
            throw new Error(errorMsg);
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
        // Sanitize data before sending to Supabase.
        // Convert empty strings in foreign key fields to null to prevent "invalid input syntax for type integer" errors.
        const sanitizedData = toUpsert.map(item => {
            const sanitizedItem = { ...item } as any; // Clone to avoid mutating original state object
            const keysToSanitize = ['salesPersonId', 'customerId', 'quotationId'];
            
            for (const key of keysToSanitize) {
                if (key in sanitizedItem && sanitizedItem[key] === '') {
                    sanitizedItem[key] = null;
                }
            }
            return sanitizedItem as T;
        });

        const { error } = await supabase.from(supabaseTableName).upsert(sanitizedData, { onConflict: primaryKey });
        if (error) {
            const errorMsg = `Failed to upsert to ${supabaseTableName}: ${error.message}`;
            console.error(errorMsg, error);
            throw new Error(errorMsg);
        }
    }
}

// --- New Scalable Functions for Products ---

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
        const errorMsg = `Failed to fetch paginated products: ${error.message}`;
        console.error(errorMsg, error);
        throw new Error(errorMsg);
    }
    
    const products = (data || []) as Product[];
    const lastVisibleDoc = offset + products.length; // The next offset

    return { products, lastVisibleDoc };
}


export async function addProductsBatch(products: Product[]): Promise<void> {
    const { error } = await supabase.from('products').upsert(products, { onConflict: 'id' });
    if (error) {
        const errorMsg = `Failed to batch add products: ${error.message}`;
        console.error(errorMsg, error);
        throw new Error(errorMsg);
    }
}

export async function deleteProductsBatch(productIds: number[]): Promise<void> {
    const { error } = await supabase.from('products').delete().in('id', productIds);
    if (error) {
        const errorMsg = `Failed to batch delete products: ${error.message}`;
        console.error(errorMsg, error);
        throw new Error(errorMsg);
    }
}

export async function updateProduct(product: Product): Promise<void> {
    const { id, ...productData } = product;
    const { error } = await supabase.from('products').update(productData).eq('id', id);
    if (error) {
        const errorMsg = `Failed to update product ${id}: ${error.message}`;
        console.error(errorMsg, error);
        throw new Error(errorMsg);
    }
}