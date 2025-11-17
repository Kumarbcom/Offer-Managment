import { useState, useEffect, useCallback, SetStateAction, useRef } from 'react';
import { get, set, TableName, toSupabaseTableName } from '../supabase';
import { INITIAL_DATA } from '../initialData';
import { supabase, supabaseConfig } from '../supabaseClient';
import { useLocalStorage } from './useLocalStorage';

type CollectionName = keyof typeof INITIAL_DATA;

const isSupabaseConfigured = supabaseConfig.url && !supabaseConfig.url.includes('YOUR_PROJECT_ID');

/**
 * A hook to manage data persistence.
 * It attempts to use Supabase if configured.
 * If Supabase is not configured or fails on initial load, it falls back to a different storage strategy:
 * - For the 'products' collection, it uses in-memory state to avoid local storage quota errors.
 * - For all other collections, it uses the browser's Local Storage.
 * This ensures the application is always usable out-of-the-box, even with large product catalogs.
 */
export const useOnlineStorage = <T extends {id?: number, name?: string}>(tableName: CollectionName): [T[] | null, (value: SetStateAction<T[]>) => Promise<void>, boolean, Error | null] => {
    
    const initialData = INITIAL_DATA[tableName] as unknown as T[];
    const useInMemoryFallback = tableName === 'products' && !isSupabaseConfigured;

    const [localData, setLocalData] = useLocalStorage<T[]>(tableName, initialData);
    const [inMemoryData, setInMemoryData] = useState<T[]>(initialData);

    const [state, setState] = useState<T[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Effect for initial data fetch
    useEffect(() => {
        if (!isSupabaseConfigured) {
            if (useInMemoryFallback) {
                setState(inMemoryData);
            } else {
                setState(localData);
            }
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await get(tableName);
                setState(data as T[]);
            } catch (e) {
                console.error(`Supabase error on loading '${tableName}':`, e);
                setError(e as Error);
                if (useInMemoryFallback) {
                    setState(inMemoryData);
                } else {
                    setState(localData);
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableName]);

    // Effect for real-time subscriptions
    useEffect(() => {
        if (!isSupabaseConfigured) {
            return;
        }
        
        const supabaseTableName = toSupabaseTableName(tableName as TableName);
        const channel = supabase
            .channel(`public:${supabaseTableName}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: supabaseTableName },
                (payload) => {
                    console.log(`Real-time change received on ${tableName}:`, payload);
                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    
                    setState(currentState => {
                        const currentData = currentState || [];
                        const primaryKey = tableName === 'users' ? 'name' : 'id';

                        if (eventType === 'INSERT') {
                            if (currentData.some(item => (item as any)[primaryKey] === (newRecord as any)[primaryKey])) {
                                return currentData; // Already exists, likely from optimistic update
                            }
                            return [...currentData, newRecord as T];
                        }
                        if (eventType === 'UPDATE') {
                            return currentData.map(item => 
                                (item as any)[primaryKey] === (newRecord as any)[primaryKey] ? newRecord as T : item
                            );
                        }
                        if (eventType === 'DELETE') {
                             const recordId = (oldRecord as any).id ?? (oldRecord as any).name;
                             return currentData.filter(item => (item as any)[primaryKey] !== recordId);
                        }
                        return currentData;
                    });
                }
            )
            .subscribe();
            
        // Cleanup function to remove the channel subscription when the component unmounts
        return () => {
            supabase.removeChannel(channel);
        };
    }, [tableName, isSupabaseConfigured]);

    const setValue = useCallback(async (value: SetStateAction<T[]>) => {
        const previousState = stateRef.current;
        const newState = value instanceof Function ? value(previousState!) : value;

        // Optimistically update the UI
        setState(newState);
        
        if (newState === undefined) {
            console.warn('State update resulted in an undefined value. Aborting persistence.');
            return;
        }

        // Handle persistence for offline/unconfigured mode
        if (!isSupabaseConfigured) {
            if (useInMemoryFallback) {
                setInMemoryData(newState);
            } else {
                await setLocalData(newState);
            }
            return;
        }

        // Persist to Supabase
        try {
            await set(tableName, previousState, newState);
        } catch (e) {
            console.error(`Supabase error on saving '${tableName}':`, e);
            setError(e as Error);
            setState(previousState); // Revert on failure
            throw e;
        }
    }, [tableName, isSupabaseConfigured, useInMemoryFallback, setLocalData, setInMemoryData]);
    
    return [state, setValue, isLoading, error];
};