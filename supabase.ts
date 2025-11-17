import { supabase } from './supabaseClient';

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
    const primaryKey = tableName === 'users' ? 'name' : 'id';
    const { data, error } = await supabase.from(supabaseTableName).select('*').order(primaryKey, { ascending: true });
    if (error) {
        const errorMsg = `Supabase Error (${supabaseTableName}): ${error.message}. Details: ${error.details}. Hint: ${error.hint}`;
        console.error(`Failed to fetch data for ${tableName}:`, error);
        throw new Error(errorMsg);
    }
    return data || [];
}

/**
 * Inserts a new record into the database and returns the created record, including the database-generated ID.
 */
export const addRecord = async (tableName: TableName, record: any) => {
    const supabaseTableName = toSupabaseTableName(tableName);
    // The 'id' field is handled by the database, so it's not included in the insert payload.
    const { id, ...recordData } = record;
    
    const { data, error } = await supabase
        .from(supabaseTableName)
        .insert(recordData)
        .select()
        .single();
        
    if (error) {
        console.error(`Failed to add record to ${supabaseTableName}:`, error);
        throw error;
    }
    return data;
};

/**
 * Updates an existing record in the database.
 */
export const updateRecord = async (tableName: TableName, record: any) => {
    const supabaseTableName = toSupabaseTableName(tableName);
    const primaryKey = tableName === 'users' ? 'name' : 'id';
    const pkValue = record[primaryKey];

    const { data, error } = await supabase
        .from(supabaseTableName)
        .update(record)
        .eq(primaryKey, pkValue)
        .select()
        .single();

    if (error) {
        console.error(`Failed to update record in ${supabaseTableName}:`, error);
        throw error;
    }
    return data;
};

/**
 * Deletes one or more records from the database by their primary keys.
 */
export const deleteRecords = async (tableName: TableName, ids: (string | number)[]) => {
    const supabaseTableName = toSupabaseTableName(tableName);
    const primaryKey = tableName === 'users' ? 'name' : 'id';

    const { error } = await supabase
        .from(supabaseTableName)
        .delete()
        .in(primaryKey, ids);
        
    if (error) {
        console.error(`Failed to delete records from ${supabaseTableName}:`, error);
        throw error;
    }
};

/**
 * Performs a high-performance bulk insert of new records.
 * By default it strips 'id' for compatibility with SERIAL columns, but can be overridden for seeding.
 */
export const bulkInsert = async (tableName: TableName, records: any[], keepIds = false) => {
    const supabaseTableName = toSupabaseTableName(tableName);
    const recordsToInsert = !keepIds ? records.map(r => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...rest } = r;
        return rest;
    }) : records;

    const { error } = await supabase.from(supabaseTableName).insert(recordsToInsert);
    if (error) {
        console.error(`Failed to bulk insert to ${supabaseTableName}:`, error);
        throw error;
    }
};

/**
 * Seeds a table with initial data. It's a wrapper around bulkInsert with keepIds=true.
 * The function signature is designed to be a drop-in for seeding logic.
 */
export const set = async (tableName: TableName, _previousData: any[], newData: any[]): Promise<void> => {
    if (newData && newData.length > 0) {
        // For seeding, we want to preserve the IDs from mock data to maintain relationships.
        await bulkInsert(tableName, newData, true);
    }
};

export async function getCustomersPaginated(options: {
  page: number;
  limit: number;
  searchTerm: string;
  searchCity: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}) {
  const { page, limit, searchTerm, searchCity, sortBy, sortOrder } = options;
  const supabaseTableName = toSupabaseTableName('customers');

  let query = supabase.from(supabaseTableName).select('*', { count: 'exact' });

  if (searchTerm) {
    query = query.ilike('name', `%${searchTerm}%`);
  }
  if (searchCity) {
    query = query.ilike('city', `%${searchCity}%`);
  }

  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    const errorMsg = `Supabase Error (customers paginated): ${error.message}.`;
    console.error(errorMsg, error);
    throw new Error(errorMsg);
  }

  return { data: data || [], count: count || 0 };
}


export async function getCustomerStats() {
    const supabaseTableName = toSupabaseTableName('customers');
    const { data, error, count } = await supabase.from(supabaseTableName).select('id, salesPersonId', { count: 'exact' });

    if (error) {
        console.error(`Failed to fetch customer stats:`, error);
        throw error;
    }

    const bySalesPerson = (data || []).reduce((acc, customer) => {
        const key = customer.salesPersonId || 'unassigned';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return { totalCount: count || 0, bySalesPerson };
}

export async function getCustomersByIds(ids: number[]) {
    if (ids.length === 0) return [];
    const supabaseTableName = toSupabaseTableName('customers');
    const { data, error } = await supabase.from(supabaseTableName).select('*').in('id', ids);
    if (error) {
        console.error(`Failed to fetch customers by ID:`, error);
        throw error;
    }
    return data || [];
}

export async function searchCustomers(searchTerm: string) {
    if (!searchTerm) return [];
    const supabaseTableName = toSupabaseTableName('customers');
    const { data, error } = await supabase
        .from(supabaseTableName)
        .select('*')
        .ilike('name', `%${searchTerm}%`)
        .limit(20);
    if (error) {
        console.error(`Failed to search customers:`, error);
        throw error;
    }
    return data || [];
}