
import { useState, useEffect, useCallback } from 'react';
import { get, addRecord, updateRecord, deleteRecords, bulkInsert, TableName, toSupabaseTableName } from '../supabase';
import { supabaseConfig, supabase } from '../supabaseClient';
import { useLocalStorage } from './useLocalStorage';

type CollectionName = TableName;
const isSupabaseConfigured = supabaseConfig.url && !supabaseConfig.url.includes('YOUR_PROJECT_ID');

export interface DataActions<T> {
  add: (item: Omit<T, 'id'>) => Promise<T>;
  update: (item: T) => Promise<T>;
  remove: (ids: (number | string)[]) => Promise<void>;
  bulkAdd: (items: Omit<T, 'id'>[]) => Promise<void>;
}

export const useOnlineStorage = <T extends {id?: number; name?: string}>(tableName: CollectionName): [T[] | null, DataActions<T>, boolean, Error | null, () => Promise<void>] => {
    
    const initialData: T[] = [];
    const useInMemoryFallback = !isSupabaseConfigured;

    const [localData, setLocalData] = useLocalStorage<T[]>(tableName, initialData);
    const [inMemoryData, setInMemoryData] = useState<T[]>(initialData);

    const [state, setState] = useState<T[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await get(tableName);
            setState(data as T[]);
        } catch (e) {
            console.error(`Supabase error on loading '${tableName}':`, e);
            setError(e as Error);
            if (useInMemoryFallback) setState(inMemoryData);
            else setState(localData);
        } finally {
            setIsLoading(false);
        }
    }, [tableName, useInMemoryFallback, inMemoryData, localData]);

    useEffect(() => {
        if (!isSupabaseConfigured) {
            if (useInMemoryFallback) setState(inMemoryData);
            else setState(localData);
            setIsLoading(false);
            return;
        }

        fetchData();

        const supabaseTableName = toSupabaseTableName(tableName);
        const primaryKey = tableName === 'users' ? 'name' : 'id';
        
        const channelName = `table-changes-${supabaseTableName}`;
        const channel = supabase.channel(channelName)
          .on('postgres_changes', { event: '*', schema: 'public', table: supabaseTableName },
            (payload: any) => {
              console.log(`Real-time event on channel ${channelName} for table ${supabaseTableName}:`, payload);
              if (payload.eventType === 'INSERT') {
                setState(prev => [...(prev || []), payload.new as T]);
              }
              if (payload.eventType === 'UPDATE') {
                setState(prev => (prev || []).map(item => (item[primaryKey] === payload.new[primaryKey]) ? payload.new as T : item));
              }
              if (payload.eventType === 'DELETE') {
                 setState(prev => (prev || []).filter(item => item[primaryKey] !== payload.old[primaryKey]));
              }
            }
          )
          .subscribe((status: string, err: any) => {
            if (status === 'SUBSCRIBED') {
              console.log(`Successfully subscribed to channel: ${channelName}`);
            }
            if (status === 'CHANNEL_ERROR') {
              console.error(`Subscription error on channel ${channelName}:`, err);
              // Fix: Safely access error message to prevent crash when error object is undefined.
              const errorMessage = err ? err.message : 'An unknown error occurred.';
              setError(new Error(`Real-time connection failed: ${errorMessage}`));
            }
          });

        return () => {
          supabase.removeChannel(channel);
        };
    }, [tableName, isSupabaseConfigured, useInMemoryFallback, inMemoryData, localData, fetchData]);

    const actions: DataActions<T> = {
        add: useCallback(async (item: Omit<T, 'id'>): Promise<T> => {
            if (!isSupabaseConfigured) {
                const newItem = { ...item, id: Date.now() } as T; // Simple fallback ID
                if(useInMemoryFallback) setInMemoryData(prev => [...prev, newItem]);
                else await setLocalData(prev => [...prev, newItem]);
                return newItem;
            }
            return await addRecord(tableName, item);
        }, [tableName, isSupabaseConfigured, useInMemoryFallback, setLocalData]),

        update: useCallback(async (item: T): Promise<T> => {
             const primaryKey = tableName === 'users' ? 'name' : 'id';
            if (!isSupabaseConfigured) {
                if(useInMemoryFallback) setInMemoryData(prev => prev.map(i => i[primaryKey] === item[primaryKey] ? item : i));
                else await setLocalData(prev => prev.map(i => i[primaryKey] === item[primaryKey] ? item : i));
                return item;
            }
            return await updateRecord(tableName, item);
        }, [tableName, isSupabaseConfigured, useInMemoryFallback, setLocalData]),

        remove: useCallback(async (ids: (string | number)[]) => {
            const primaryKey = tableName === 'users' ? 'name' : 'id';
            if (!isSupabaseConfigured) {
                const idSet = new Set(ids);
                if(useInMemoryFallback) setInMemoryData(prev => prev.filter(i => !idSet.has(i[primaryKey]!)));
                else await setLocalData(prev => prev.filter(i => !idSet.has(i[primaryKey]!)));
                return;
            }
            await deleteRecords(tableName, ids);
        }, [tableName, isSupabaseConfigured, useInMemoryFallback, setLocalData]),

        bulkAdd: useCallback(async (items: Omit<T, 'id'>[]) => {
            if (!isSupabaseConfigured) {
                alert("Bulk add is not supported in offline mode.");
                return;
            }
            await bulkInsert(tableName, items);
        }, [tableName, isSupabaseConfigured]),
    };
    
    return [state, actions, isLoading, error, fetchData];
};
