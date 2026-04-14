
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

/**
 * Maps application camelCase objects to Supabase snake_case columns.
 */
function mapToSupabase(tableName: TableName, item: any): any {
    const mapped: any = { ...item };
    
    // Always remove 'id' from numeric primary key tables if we want Postgres to handle it (not applicable here as we use custom numeric IDs)
    // However, for 'users' table, 'name' is the primary key.
    
    // Manual mapping for quotations
    if (tableName === 'quotations') {
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
        if ('customerId' in item) mapped.customer_id = item.customerId;
    }

    // Manual mapping for products
    if (tableName === 'products') {
        if ('partNo' in item) mapped.part_no = item.partNo;
        if ('hsnCode' in item) mapped.hsn_code = item.hsnCode;
    }

    // Manual mapping for customers
    if (tableName === 'customers') {
        if ('salesPersonId' in item) mapped.sales_person_id = item.salesPersonId;
        if ('discountStructure' in item) mapped.discount_structure = item.discountStructure;
    }

    // Remove camelCase versions after mapping to snake_case
    const keysToRemove = [
        'quotationDate', 'enquiryDate', 'salesPersonId', 'contactPerson', 
        'contactNumber', 'productsBrand', 'modeOfEnquiry', 'otherTerms', 
        'paymentTerms', 'preparedBy', 'gstAdded', 'partNo', 'hsnCode', 
        'discountStructure', 'customerId'
    ];
    keysToRemove.forEach(k => delete mapped[k]);

    return mapped;
}

/**
 * Maps Supabase snake_case columns back to application camelCase objects.
 */
function mapFromSupabase(tableName: TableName, item: any): any {
    const mapped: any = { ...item };
    
    // Common fields
    if ('created_at' in item) mapped.createdAt = item.created_at;

    // Quotation fields
    if ('quotation_date' in item) mapped.quotationDate = item.quotation_date;
    if ('enquiry_date' in item) mapped.enquiryDate = item.enquiry_date;
    if ('sales_person_id' in item) mapped.salesPersonId = item.sales_person_id;
    if ('customer_id' in item) mapped.customerId = item.customer_id;
    if ('contact_person' in item) mapped.contactPerson = item.contact_person;
    if ('contact_number' in item) mapped.contactNumber = item.contact_number;
    if ('products_brand' in item) mapped.productsBrand = item.products_brand;
    if ('mode_of_enquiry' in item) mapped.modeOfEnquiry = item.mode_of_enquiry;
    if ('other_terms' in item) mapped.otherTerms = item.other_terms;
    if ('payment_terms' in item) mapped.paymentTerms = item.payment_terms;
    if ('prepared_by' in item) mapped.preparedBy = item.prepared_by;
    if ('gst_added' in item) mapped.gstAdded = item.gst_added;
    if ('hsn_code' in item) mapped.hsnCode = item.hsn_code;

    // Product fields
    if ('part_no' in item) mapped.partNo = item.part_no;
    if ('hsn_code' in item && tableName === 'products') mapped.hsnCode = item.hsn_code;

    // Customer fields
    if ('sales_person_id' in item && tableName === 'customers') mapped.salesPersonId = item.sales_person_id;
    if ('discount_structure' in item) mapped.discountStructure = item.discount_structure;

    return mapped;
}

export async function get(tableName: TableName): Promise<any[]> {
    if (!supabase) return [];
    const supabaseTableName = toSupabaseTableName(tableName);
    const { data, error } = await supabase.from(supabaseTableName).select('*');
    if (error) throw new Error(error.message);
    return (data || []).map(item => mapFromSupabase(tableName, item));
}

export async function set(tableName: TableName, previousState: any[] | null, newState: any[]): Promise<any[]> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const supabaseTableName = toSupabaseTableName(tableName);

    // Identify changes
    const previousMap = new Map((previousState || []).map(item => [tableName === 'users' ? item.name : item.id, item]));
    const currentKeys = new Set(newState.map(item => tableName === 'users' ? item.name : item.id));

    // Deletions
    const toDelete = (previousState || []).filter(item => !currentKeys.has(tableName === 'users' ? item.name : item.id));
    for (const item of toDelete) {
        const id = tableName === 'users' ? item.name : item.id;
        const key = tableName === 'users' ? 'name' : 'id';
        await supabase.from(supabaseTableName).delete().eq(key, id);
    }

    // Upserts (Insert or Update)
    const toUpsert = newState.map(item => mapToSupabase(tableName, item));
    if (toUpsert.length > 0) {
        const { data, error } = await supabase.from(supabaseTableName).upsert(toUpsert, { onConflict: tableName === 'users' ? 'name' : 'id' }).select();
        if (error) throw new Error(error.message);
        return (data || []).map(item => mapFromSupabase(tableName, item));
    }

    return [];
}

export async function searchProducts(term: string) {
    if (!supabase) return [];
    let query = supabase.from('products').select('*').limit(50);
    if (term) {
        const terms = term.split('*').map(t => t.trim()).filter(Boolean);
        if (terms.length > 0) {
            const partNoFilters = terms.map(t => `part_no.ilike.*${t}*`).join(',');
            const descriptionFilters = terms.map(t => `description.ilike.*${t}*`).join(',');
            query = query.or(`${partNoFilters},${descriptionFilters}`);
        }
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(item => mapFromSupabase('products', item));
}

// Helper for CustomerAddModal
export async function getCustomersPaginated(page: number, pageSize: number) {
    if (!supabase) return { data: [], count: 0 };
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('name')
        .range(from, to);
    
    if (error) throw new Error(error.message);
    return {
        data: (data || []).map(item => mapFromSupabase('customers', item)),
        count: count || 0
    };
}

export async function getSalesPersons() {
    return get('salesPersons');
}

export async function upsertCustomer(customer: any) {
    const toUpsert = mapToSupabase('customers', customer);
    const { data, error } = await supabase!.from('customers').upsert(toUpsert).select();
    if (error) throw new Error(error.message);
    return (data || []).map(item => mapFromSupabase('customers', item))[0];
}

export async function deleteCustomer(id: number) {
    const { error } = await supabase!.from('customers').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

export async function addCustomersBatch(customers: any[]) {
    const toUpsert = customers.map(c => mapToSupabase('customers', c));
    const { error } = await supabase!.from('customers').upsert(toUpsert);
    if (error) throw new Error(error.message);
}

export async function deleteProductsBatch(ids: number[]) {
    const { error } = await supabase!.from('products').delete().in('id', ids);
    if (error) throw new Error(error.message);
}

export async function updateProduct(product: any) {
    const toUpsert = mapToSupabase('products', product);
    const { error } = await supabase!.from('products').update(toUpsert).eq('id', product.id);
    if (error) throw new Error(error.message);
}

export async function addProductsBatch(products: any[]) {
    const toUpsert = products.map(p => mapToSupabase('products', p));
    const { error } = await supabase!.from('products').upsert(toUpsert);
    if (error) throw new Error(error.message);
}

export async function getProductsPaginated(page: number, pageSize: number) {
    if (!supabase) return { data: [], count: 0 };
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('id')
        .range(from, to);
    
    if (error) throw new Error(error.message);
    return {
        data: (data || []).map(item => mapFromSupabase('products', item)),
        count: count || 0
    };
}

export async function getProductsByIds(ids: number[]) {
    if (!supabase || !ids.length) return [];
    const { data, error } = await supabase.from('products').select('*').in('id', ids);
    if (error) throw new Error(error.message);
    return (data || []).map(item => mapFromSupabase('products', item));
}

export async function getProductsByPartNos(partNos: string[]) {
    if (!supabase || !partNos.length) return [];
    const { data, error } = await supabase.from('products').select('*').in('part_no', partNos);
    if (error) throw new Error(error.message);
    return (data || []).map(item => mapFromSupabase('products', item));
}

export async function fetchAllProductsForExport() {
    return get('products');
}

export async function searchCustomers(term: string) {
    if (!supabase) return [];
    let query = supabase.from('customers').select('*').limit(50);
    if (term) {
        query = query.ilike('name', `%${term}%`);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []).map(item => mapFromSupabase('customers', item));
}

export async function getCustomersByIds(ids: number[]) {
    if (!supabase || !ids.length) return [];
    const { data, error } = await supabase.from('customers').select('*').in('id', ids);
    if (error) throw new Error(error.message);
    return (data || []).map(item => mapFromSupabase('customers', item));
}

export async function countRecords(tableName: TableName): Promise<number> {
    if (!supabase) return 0;
    const { count, error } = await supabase
        .from(toSupabaseTableName(tableName))
        .select('*', { count: 'exact', head: true });
    
    if (error) throw new Error(error.message);
    return count || 0;
}

export async function clearTable(tableName: TableName): Promise<void> {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { error } = await supabase
        .from(toSupabaseTableName(tableName))
        .delete()
        .neq('id', -999); // Deletes all rows where ID is not -999 (standard way to clear table without TRUNCATE permissions)
    
    if (error) throw new Error(error.message);
}
