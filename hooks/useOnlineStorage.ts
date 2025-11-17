import { useState, useEffect, useCallback, SetStateAction, useRef } from 'react';
import { get, set } from '../supabase';
import { INITIAL_DATA } from '../initialData';
import { supabaseConfig } from '../supabaseClient';
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
                // The seeding logic is now handled globally at app startup.
                // This hook now only fetches the data.
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

    const setValue = useCallback(async (value: SetStateAction<T[]>) => {
        const previousState = stateRef.current;
        const newState = value instanceof Function ? value(previousState!) : value;

        setState(newState);
        
        if (newState === undefined) {
            console.warn('State update resulted in an undefined value. Aborting persistence.');
            return;
        }

        if (!isSupabaseConfigured) {
            if (useInMemoryFallback) {
                setInMemoryData(newState);
            } else {
                await setLocalData(newState);
            }
            return;
        }

        try {
            await set(tableName, previousState, newState);
        } catch (e) {
            console.error(`Supabase error on saving '${tableName}':`, e);
            setError(e as Error);
            setState(previousState);
            throw e;
        }
    }, [tableName, isSupabaseConfigured, useInMemoryFallback, setLocalData, setInMemoryData]);
    
    return [state, setValue, isLoading, error];
};
