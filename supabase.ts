
import { createClient } from '@supabase/supabase-js';
import { Product, Customer, SalesPerson, User, Quotation } from './types';

const SUPABASE_URL = 'https://hrvjlqqldbgzlvqavwwl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydmpscXFsZGJnemx2cWF2d3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNDU1OTksImV4cCI6MjA3ODkyMTU5OX0.qW6P4aQbVjhKEZLzyoIYnPcxn-ZALfdq_JJi-_Fb2PA';

export const supabaseConfig = {
    url: SUPABASE_URL,
    key: SUPABASE_KEY
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type TableName = 'products' | 'customers' | 'salesPersons' | 'users' | 'quotations' | 'stockStatements' | 'pendingSOs';

export function toSupabaseTableName(tableName: TableName): string {
    switch (tableName) {
        case 'products': return 'products';
        case 'customers': return 'customers';
        case 'salesPersons': return 'sales_persons';
        case 'users': return 'users';
        case 'quotations': return 'quotations';
        case 'stockStatements': return 'stock_statement';
        case 'pendingSOs': return 'pending_sales_orders';
        default: return tableName;
    }
}

function mapToSupabase(tableName: TableName, item: any): any {
    const mapped: any = {};
    Object.keys(item).forEach(key => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        mapped[snakeKey] = item[key];
    });
    return mapped;
}

function mapFromSupabase(tableName: TableName, item: any): any {
    const mapped: any = {};
    
    // 1. Lowercase all keys from Supabase to normalize
    const raw: any = {};
    Object.keys(item).forEach(k => raw[k.toLowerCase()] = item[k]);

    // 2. Map all known fields with extreme flexibility
    const mapping: Record<string, string[]> = {
        id: ['id'],
        quotationDate: ['quotation_date', 'quotationdate', 'date', 'created_at'],
        enquiryDate: ['enquiry_date', 'enquirydate'],
        customerId: ['customer_id', 'customerid', 'customer'],
        contactPerson: ['contact_person', 'contactperson', 'contact'],
        contactNumber: ['contact_number', 'contactnumber', 'phone', 'mobile'],
        salesPersonId: ['sales_person_id', 'salespersonid', 'sales_person'],
        status: ['status'],
        comments: ['comments'],
        details: ['details'],
        productsBrand: ['products_brand', 'brand'],
        modeOfEnquiry: ['mode_of_enquiry', 'mode'],
        otherTerms: ['other_terms'],
        paymentTerms: ['payment_terms'],
        preparedBy: ['prepared_by'],
        gstAdded: ['gst_added'],
        hsnCode: ['hsn_code', 'hsn'],
        partNo: ['part_no', 'partnumber'],
        description: ['description'],
        prices: ['prices'],
        uom: ['uom'],
        plant: ['plant']
    };

    Object.keys(mapping).forEach(target => {
        const sources = mapping[target];
        for (const src of sources) {
            if (raw[src] !== undefined && raw[src] !== null) {
                mapped[target] = raw[src];
                break;
            }
        }
    });

    // 3. Fallback for any other fields (standard snake to camel)
    Object.keys(item).forEach(key => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (mapped[camelKey] === undefined) {
            mapped[camelKey] = item[key];
        }
    });

    return mapped;
}

export async function get(tableName: TableName): Promise<any[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.from(toSupabaseTableName(tableName)).select('*');
    if (error) throw new Error(error.message);
    
    // Filter out completely empty rows (trash data)
    const validData = (data || []).filter(item => Object.keys(item).length > 2);
    
    return validData.map(item => mapFromSupabase(tableName, item));
}

export async function set(tableName: TableName, previousState: any[] | null, newState: any[]): Promise<any[]> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const supabaseTableName = toSupabaseTableName(tableName);
    const pk = (tableName === 'users') ? 'name' : 'id';

    if (previousState) {
        const currentKeys = new Set(newState.map(item => item[pk]));
        const toDelete = previousState.filter(item => !currentKeys.has(item[pk]));
        for (const item of toDelete) {
            await supabase.from(supabaseTableName).delete().eq(pk, item[pk]);
        }
    }

    const toUpsert = newState.map(item => mapToSupabase(tableName, item));
    if (toUpsert.length > 0) {
        const { data, error } = await supabase.from(supabaseTableName).upsert(toUpsert, { onConflict: pk }).select();
        if (error) throw new Error(error.message);
        return (data || []).map(item => mapFromSupabase(tableName, item));
    }
    return [];
}

export async function countRecords(tableName: TableName): Promise<number> {
    if (!supabase) return 0;
    const { count, error } = await supabase.from(toSupabaseTableName(tableName)).select('*', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return count || 0;
}

export async function clearTable(tableName: TableName): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const pk = (tableName === 'users') ? 'name' : 'id';
    const { error } = await supabase.from(toSupabaseTableName(tableName)).delete().not(pk, 'is', null);
    if (error) throw new Error(error.message);
}

// RESTORED HELPERS
export async function searchProducts(term: string) {
    if (!supabase) return [];
    const { data, error } = await supabase.from('products').select('*').or(`part_no.ilike.%${term}%,description.ilike.%${term}%`).limit(50);
    if (error) throw new Error(error.message);
    return (data || []).map(item => mapFromSupabase('products', item));
}

export async function getCustomersPaginated(page: number, pageSize: number) {
    if (!supabase) return { data: [], count: 0 };
    const from = (page - 1) * pageSize;
    const { data, error, count } = await supabase.from('customers').select('*', { count: 'exact' }).order('name').range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    return { data: (data || []).map(item => mapFromSupabase('customers', item)), count: count || 0 };
}

export async function getProductsPaginated(page: number, pageSize: number) {
    if (!supabase) return { data: [], count: 0 };
    const from = (page - 1) * pageSize;
    const { data, error, count } = await supabase.from('products').select('*', { count: 'exact' }).order('id').range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    return { data: (data || []).map(item => mapFromSupabase('products', item)), count: count || 0 };
}

export async function searchCustomers(term: string) {
    if (!supabase) return [];
    const { data, error } = await supabase.from('customers').select('*').ilike('name', `%${term}%`).limit(50);
    if (error) throw new Error(error.message);
    return (data || []).map(item => mapFromSupabase('customers', item));
}

export async function getSalesPersons() { return get('salesPersons'); }
export async function upsertCustomer(c: any) { const res = await set('customers', null, [c]); return res[0]; }
export async function deleteCustomer(id: number) { await supabase!.from('customers').delete().eq('id', id); }
export async function addCustomersBatch(c: any[]) { await set('customers', null, c); }
export async function deleteProductsBatch(ids: any[]) { await supabase!.from('products').delete().in('id', ids); }
export async function updateProduct(p: any) { await set('products', null, [p]); }
export async function addProductsBatch(p: any[]) { await set('products', null, p); }
export async function getProductsByIds(ids: any[]) { const { data } = await supabase!.from('products').select('*').in('id', ids); return (data || []).map(i => mapFromSupabase('products', i)); }
export async function getCustomersByIds(ids: any[]) { const { data } = await supabase!.from('customers').select('*').in('id', ids); return (data || []).map(i => mapFromSupabase('customers', i)); }
export async function getProductsByPartNos(p: any[]) { const { data } = await supabase!.from('products').select('*').in('part_no', p); return (data || []).map(i => mapFromSupabase('products', i)); }
export async function fetchAllProductsForExport() { return get('products'); }
