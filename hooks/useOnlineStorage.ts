
import { useState, useEffect, useCallback, SetStateAction, useRef } from 'react';
import { get, set, toSupabaseTableName } from '../supabase';
import { INITIAL_DATA } from '../initialData';
import { supabase, supabaseConfig } from '../supabaseClient';
import { useLocalStorage } from './useLocalStorage';

type CollectionName = keyof typeof INITIAL_DATA;

const isSupabaseConfigured = supabaseConfig.url && !supabaseConfig.url.includes('YOUR_PROJECT_ID');

const seededTables = new Set<CollectionName>();

/**
 * A hook to manage data persistence with real-time synchronization.
 * It uses Supabase for data storage and real-time updates.
 * If Supabase is not configured or fails, it falls back to Local Storage (or in-memory for products).
 */
export const useOnlineStorage = <T extends {id?: number | string, name?: string}>(tableName: CollectionName): [T[] | null, (value: SetStateAction<T[]>) => Promise<void>, boolean, Error | null] => {
    
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
                let data = await get(tableName);
                if (data.length === 0 && !seededTables.has(tableName)) {
                    // Only seed if not one of the new empty tables, unless we want dummy data
                    if (tableName !== 'stockStatements' && tableName !== 'pendingSOs') {
                        console.log(`Supabase table '${tableName}' is empty. Seeding with initial data.`);
                        await set(tableName, [], initialData);
                        seededTables.add(tableName);
                        data = await get(tableName);
                    }
                }
                setState(data as T[]);
            } catch (e) {
                console.warn(`Supabase error on loading '${tableName}', falling back to local data.`, e);
                // Do not set a fatal error. Let the app continue with fallback data.
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

        // --- REAL-TIME SUBSCRIPTION LOGIC ---
        // CRITICAL FIX: Check if supabase client exists before trying to subscribe
        if (!supabase) {
            return;
        }

        const supabaseTableName = toSupabaseTableName(tableName);
        const channelName = `table-changes-${tableName}`;
        const primaryKey = tableName === 'users' ? 'name' : 'id';

        let channel: any;
        try {
            channel = supabase
                .channel(channelName)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: supabaseTableName },
                    (payload: any) => {
                        const currentState = stateRef.current || [];
                        switch (payload.eventType) {
                            case 'INSERT': {
                                const newRecord = payload.new as T;
                                // Add if not already present (handles local echo)
                                if (!currentState.some(item => (item as any)[primaryKey] === (newRecord as any)[primaryKey])) {
                                    setState(prev => [...(prev || []), newRecord]);
                                }
                                break;
                            }
                            case 'UPDATE': {
                                const updatedRecord = payload.new as T;
                                setState(prev => (prev || []).map(item =>
                                    (item as any)[primaryKey] === (updatedRecord as any)[primaryKey] ? updatedRecord : item
                                ));
                                break;
                            }
                            case 'DELETE': {
                                const oldRecord = payload.old as Partial<T>;
                                const recordIdToDelete = (oldRecord as any)[primaryKey];
                                setState(prev => (prev || []).filter(item => (item as any)[primaryKey] !== recordIdToDelete));
                                break;
                            }
                        }
                    }
                )
                .subscribe((status: string, err?: Error) => {
                    if (status === 'SUBSCRIBED') {
                        // console.log(`Successfully subscribed to real-time updates for ${tableName}`);
                    }
                    if (status === 'CHANNEL_ERROR' || err) {
                        const subError = new Error(`Subscription error on channel ${channelName}: Real-time updates for '${tableName}' might not be working. Ensure replication is enabled for the '${supabaseTableName}' table in your Supabase project settings.`);
                        console.warn(subError, err);
                        // Do not set a fatal error for subscription issues.
                    }
                });
        } catch(subError) {
             console.warn(`Failed to initialize subscription for ${tableName}. Real-time updates will be disabled. Error:`, subError);
        }

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
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
            const errorMessage = e instanceof Error ? e.message : String(e);
            const lowerMsg = errorMessage.toLowerCase();
            
            // Handle missing table errors by falling back to local storage silently (or with a log)
            // Broader check for various "table missing" error formats
            if (
                lowerMsg.includes("could not find the table") || 
                lowerMsg.includes("relation") && lowerMsg.includes("does not exist") ||
                lowerMsg.includes("42p01") || 
                lowerMsg.includes("schema cache") ||
                lowerMsg.includes("client not initialized")
            ) {
                console.warn(`Supabase issue for '${tableName}': ${errorMessage}. Falling back to local storage for this session.`);
                if (!useInMemoryFallback) {
                    await setLocalData(newState);
                } else {
                    setInMemoryData(newState);
                }
                // Do NOT revert the optimistic update; we successfully saved to local.
                return;
            }

            console.error(`Supabase error on saving '${tableName}':`, e);
            
            // Revert optimistic update on failure for genuine errors (network, validation, etc)
            setState(previousState);
            
            // Notify user of the failure but do not crash the app.
            alert(`Failed to save changes for ${tableName}. Your changes have been reverted. Please check your connection and try again.\n\nError: ${errorMessage}`);
        }
    }, [tableName, isSupabaseConfigured, useInMemoryFallback, setLocalData, setInMemoryData]);
    
    return [state, setValue, isLoading, error];
};