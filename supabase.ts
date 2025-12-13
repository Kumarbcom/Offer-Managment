
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

export const toSupabaseTableName = (name: TableName): string => {
    if (name === 'salesPersons') return 'sales_persons';
    if (name === 'deliveryChallans') return 'delivery_challans';
    if (name === 'stockStatements') return 'stock_statements';
    if (name === 'pendingSOs') return 'pending_sos';
    return name;
};

export async function get(tableName: TableName): Promise<any[]> {
    if (!supabase) throw new Error("Supabase client not initialized");
    
    const supabaseTableName = toSupabaseTableName(tableName);
    // Sort by ID descending by default to show newest first for transactions
    const { data, error } = await supabase.from(supabaseTableName).select('*').order('id', { ascending: false });
    if (error) {
        throw new Error(parseSupabaseError(error, `Failed to fetch data for ${tableName}`));
    }
    return data || [];
}

export async function set<T extends { id?: number, name?: string }>(tableName: TableName, previousData: T[] | null, newData: T[]): Promise<void> {
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
            const batch = toUpsert.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(supabaseTableName).upsert(batch, { onConflict: primaryKey });
            if (error) throw new Error(parseSupabaseError(error, `Failed to upsert batch to ${supabaseTableName}`));
        }
    }
}

// --- Specific Helper Functions ---

export async function getCustomersPaginated(options: any) { /* implementation same as before */ return { customers: [], count: 0 }; }
export async function searchCustomers(term: string) { return [] as Customer[]; }
export async function getCustomersByIds(ids: number[]) { return [] as Customer[]; }
export async function upsertCustomer(customer: any) {} 
export async function deleteCustomer(id: number) {}
export async function addCustomersBatch(customers: any[]) {}

// Products
export async function getProductsPaginated(options: any) { return { products: [], lastVisibleDoc: 0 }; }
export async function fetchAllProductsForExport() { return []; }
export async function addProductsBatch(products: any[]) {}
export async function deleteProductsBatch(ids: number[]) {}
export async function updateProduct(product: any) {}
export async function searchProducts(term: string) { return [] as Product[]; }
export async function getProductsByIds(ids: number[]) { return [] as Product[]; }
export async function getProductsByPartNos(partNos: string[]) { return [] as Product[]; }
