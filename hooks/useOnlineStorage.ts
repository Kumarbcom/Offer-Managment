
import { useState, useEffect, useCallback, SetStateAction, useRef } from 'react';
import { get, set, toSupabaseTableName, mapFromSupabase } from '../supabase';
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
                
                // --- MERGE LOGIC ---
                // If local storage has items that are NOT in Supabase, we merge them 
                // to prevent data loss from previous sync failures.
                const primaryKey = tableName === 'users' ? 'name' : 'id';
                const supabaseKeys = new Set(data.map((item: any) => (item as any)[primaryKey]));
                const localOnlyItems = (localData || []).filter(item => {
                    const key = (item as any)[primaryKey];
                    return key !== undefined && !supabaseKeys.has(key);
                });

                if (localOnlyItems.length > 0) {
                    console.log(`[Supabase Sync] Found ${localOnlyItems.length} local items missing from Supabase for '${tableName}'. Merging to prevent data loss.`);
                    const mergedData = [...data, ...localOnlyItems] as T[];
                    setState(mergedData);
                    
                    // Proactively sync the merged data back to Supabase
                    // We use the fetched 'data' as previousState so Supabase 'set' sees the local items as new
                    set(tableName, data as T[], mergedData).catch(err => {
                        console.warn(`[Supabase Sync] Failed to push merged local data for '${tableName}':`, err);
                    });
                } else {
                    setState(data as T[]);
                }
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
                                const newRecord = mapFromSupabase(tableName, payload.new) as T;
                                // Add if not already present (handles local echo)
                                if (!currentState.some(item => (item as any)[primaryKey] === (newRecord as any)[primaryKey])) {
                                    setState(prev => [...(prev || []), newRecord]);
                                }
                                break;
                            }
                            case 'UPDATE': {
                                const updatedRecord = mapFromSupabase(tableName, payload.new) as T;
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

        if (newState === undefined) {
            console.warn('State update resulted in an undefined value. Aborting persistence.');
            return;
        }

        // 1. Update memory state (Optimistic)
        setState(newState);
        
        // 2. Always save to local storage as a backup
        if (useInMemoryFallback) {
            setInMemoryData(newState);
        } else {
            await setLocalData(newState);
        }

        // 3. If Supabase is not configured, we're done
        if (!isSupabaseConfigured) {
            return;
        }

        // 4. Try to sync to Supabase
        try {
            await set(tableName, previousState, newState);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            const lowerMsg = errorMessage.toLowerCase();
            
            // If it's a "table missing" error, we've already saved to local storage above, so just warn
            if (
                lowerMsg.includes("could not find the table") || 
                lowerMsg.includes("relation") && lowerMsg.includes("does not exist") ||
                lowerMsg.includes("42p01") || 
                lowerMsg.includes("schema cache") ||
                lowerMsg.includes("client not initialized")
            ) {
                console.warn(`Supabase issue for '${tableName}': ${errorMessage}. Using local storage backup.`);
                return;
            }

            console.error(`Supabase error on saving '${tableName}':`, e);
            
            // For other errors (validation, constraints), we keep the local storage backup 
            // but we might want to notify the user that the cloud sync failed.
            // We DON'T revert the memory state anymore because we have the local backup.
            // This allows the user to keep working and try syncing later.
            console.warn(`[Supabase Sync] Failed to sync '${tableName}' to cloud. Data is saved locally in your browser.`, e);
        }
    }, [tableName, isSupabaseConfigured, useInMemoryFallback, setLocalData, setInMemoryData]);
    
    return [state, setValue, isLoading, error];
};