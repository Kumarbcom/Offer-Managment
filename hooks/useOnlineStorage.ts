
import { useState, useEffect, useCallback, SetStateAction, useRef } from 'react';
import { get, set, toSupabaseTableName } from '../supabase';
import { INITIAL_DATA } from '../initialData';
import { supabase, supabaseConfig } from '../supabaseClient';
import { useLocalStorage } from './useLocalStorage';

type CollectionName = keyof typeof INITIAL_DATA;

const isSupabaseConfigured = supabaseConfig.url && !supabaseConfig.url.includes('YOUR_PROJECT_ID');

const seededTables = new Set<CollectionName>();

// --- Pending Sync Queue helpers ---
// When a Supabase write fails, items are stored here and retried on next load.

const getPendingSyncKey = (tableName: CollectionName) => `pending_sync_${tableName}`;

function readPendingSync<T>(tableName: CollectionName): T[] {
    try {
        const raw = localStorage.getItem(getPendingSyncKey(tableName));
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function writePendingSync<T>(tableName: CollectionName, items: T[]) {
    try {
        if (items.length === 0) {
            localStorage.removeItem(getPendingSyncKey(tableName));
        } else {
            localStorage.setItem(getPendingSyncKey(tableName), JSON.stringify(items));
        }
    } catch (e) {
        console.warn(`Failed to write pending sync for ${tableName}:`, e);
    }
}

function addToPendingSync<T extends { id?: number | string; name?: string }>(
    tableName: CollectionName,
    newItems: T[]
) {
    const primaryKey = tableName === 'users' ? 'name' : 'id';
    const existing = readPendingSync<T>(tableName);
    const existingKeys = new Set(existing.map((i: any) => i[primaryKey]));
    const toAdd = newItems.filter((i: any) => i[primaryKey] && !existingKeys.has(i[primaryKey]));
    writePendingSync(tableName, [...existing, ...toAdd]);
}

/**
 * A hook to manage data persistence with real-time synchronization.
 * It uses Supabase for data storage and real-time updates.
 * If Supabase is not configured or fails, it falls back to Local Storage (or in-memory for products).
 * Failed Supabase writes are stored in a pending-sync queue and retried automatically on next load.
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

                // --- PENDING SYNC: Retry any failed writes from previous sessions ---
                const primaryKey = tableName === 'users' ? 'name' : 'id';
                const pendingItems = readPendingSync<T>(tableName);

                if (pendingItems.length > 0) {
                    console.log(`[PENDING-SYNC] Found ${pendingItems.length} unsynced item(s) for '${tableName}'. Retrying push to Supabase...`);
                    
                    // Find truly pending items (not already in Supabase)
                    const supabaseKeys = new Set(data.map((item: any) => item[primaryKey]));
                    const stillPending = pendingItems.filter((item: any) => 
                        item[primaryKey] && !supabaseKeys.has(item[primaryKey])
                    );

                    if (stillPending.length > 0) {
                        try {
                            await set(tableName, [], stillPending);
                            console.log(`[PENDING-SYNC] ✅ Successfully synced ${stillPending.length} item(s) for '${tableName}' to Supabase.`);
                            writePendingSync(tableName, []); // Clear queue on success
                            // Re-fetch to get server-assigned data
                            data = await get(tableName);
                        } catch (syncError) {
                            console.warn(`[PENDING-SYNC] ⚠️ Failed to sync pending items for '${tableName}'. Will retry next session.`, syncError);
                            // Keep them in state so user can see them, even if Supabase still rejects
                            const existingKeys = new Set(data.map((item: any) => item[primaryKey]));
                            const localOnlyItems = stillPending.filter((item: any) => !existingKeys.has(item[primaryKey]));
                            data = [...data, ...localOnlyItems];
                        }
                    } else {
                        // All pending items already exist in Supabase — clear queue
                        writePendingSync(tableName, []);
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
                    if (status === 'CHANNEL_ERROR' || err) {
                        const subError = new Error(`Subscription error on channel ${channelName}: Real-time updates for '${tableName}' might not be working. Ensure replication is enabled for the '${supabaseTableName}' table in your Supabase project settings.`);
                        console.warn(subError, err);
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

        console.log(`[DEBUG-STORAGE] setValue called for '${tableName}', newState.length=${newState?.length || 0}`);

        setState(newState);
        
        if (newState === undefined) {
            console.warn('State update resulted in an undefined value. Aborting persistence.');
            return;
        }

        if (!isSupabaseConfigured) {
            console.log(`[DEBUG-STORAGE] Supabase NOT configured for '${tableName}', using local storage`);
            if (useInMemoryFallback) {
                setInMemoryData(newState);
            } else {
                await setLocalData(newState);
            }
            return;
        }

        try {
            console.log(`[DEBUG-STORAGE] Calling Supabase.set() for '${tableName}'`);
            const savedData = await set(tableName, previousState, newState);
            
            // If Supabase returned data (e.g. with new IDs), merge it back into state.
            if (savedData && Array.isArray(savedData) && savedData.length > 0) {
                setState(current => {
                    const currentMap = new Map((current || []).map(item => [item.id, item]));
                    savedData.forEach(item => {
                        currentMap.set(item.id, item);
                    });
                    return Array.from(currentMap.values());
                });
                // Supabase succeeded — clear any pending items that match
                const primaryKey = tableName === 'users' ? 'name' : 'id';
                const savedKeys = new Set(savedData.map((i: any) => i[primaryKey]));
                const remaining = readPendingSync<T>(tableName).filter((i: any) => !savedKeys.has(i[primaryKey]));
                writePendingSync(tableName, remaining);
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            const lowerMsg = errorMessage.toLowerCase();
            
            // Handle missing table errors by falling back to local storage silently
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
                return;
            }

            console.error(`Supabase error on saving '${tableName}':`, e);

            // PENDING SYNC: Queue the NEW items (diff vs previousState) so they retry on next load
            const primaryKey = tableName === 'users' ? 'name' : 'id';
            const prevKeys = new Set((previousState || []).map((i: any) => i[primaryKey]));
            const newItems = newState.filter((i: any) => i[primaryKey] && !prevKeys.has(i[primaryKey]));
            const changedItems = newState.filter((i: any) => {
                if (!i[primaryKey] || !prevKeys.has(i[primaryKey])) return false;
                const prev = (previousState || []).find((p: any) => p[primaryKey] === i[primaryKey]);
                return JSON.stringify(prev) !== JSON.stringify(i);
            });
            const itemsToQueue = [...newItems, ...changedItems];
            
            if (itemsToQueue.length > 0) {
                addToPendingSync(tableName, itemsToQueue);
                console.warn(`[PENDING-SYNC] Queued ${itemsToQueue.length} item(s) for '${tableName}' to retry on next load.`);
            }

            // Also save full state to local storage as immediate fallback
            if (!useInMemoryFallback) {
                await setLocalData(newState);
            } else {
                setInMemoryData(newState);
            }

            // Inform user — data is safe, will auto-retry
            alert(`⚠️ Cloud Sync Failed (${tableName})\n\n${errorMessage}\n\nYour data is saved locally and will automatically sync to the cloud on next load.\n\nIf this repeats, go to Storage → check the Supabase status, or contact admin to check RLS policies.`);
        }
    }, [tableName, isSupabaseConfigured, useInMemoryFallback, setLocalData, setInMemoryData]);
    
    return [state, setValue, isLoading, error];
};