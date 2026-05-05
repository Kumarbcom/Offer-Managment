
import { useState, useEffect, useCallback, SetStateAction, useRef } from 'react';
import { get, set, toSupabaseTableName } from '../supabase';
import { INITIAL_DATA } from '../initialData';
import { supabase, supabaseConfig } from '../supabaseClient';
import { useLocalStorage } from './useLocalStorage';

type CollectionName = keyof typeof INITIAL_DATA;

const isSupabaseConfigured = !!(supabaseConfig.url && !supabaseConfig.url.includes('YOUR_PROJECT_ID'));

const seededTables = new Set<CollectionName>();

// When Supabase is configured, proactively clear localStorage for all known tables
// to recover quota space. localStorage should only be used when Supabase is absent.
if (isSupabaseConfigured) {
    const tablesToClear: CollectionName[] = [
        'quotations', 'customers', 'products', 'salesPersons',
        'deliveryChallans', 'pendingSOs', 'stockStatements'
        // 'users' is intentionally kept — needed for offline login fallback
    ];
    tablesToClear.forEach(key => {
        try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
    });
}

/**
 * A hook to manage data persistence with real-time synchronization via Supabase.
 *
 * Storage strategy:
 * - Supabase configured  → All reads/writes go to Supabase. localStorage is NEVER written.
 *                          On Supabase failure, falls back to in-memory state only.
 * - Supabase not configured → Falls back to localStorage (small tables) or in-memory (products).
 */
export const useOnlineStorage = <T extends {id?: number | string, name?: string}>(tableName: CollectionName): [T[] | null, (value: SetStateAction<T[]>) => Promise<void>, boolean, Error | null] => {
    
    const initialData = INITIAL_DATA[tableName] as unknown as T[];

    // localStorage fallback is only used when Supabase is not configured
    // 'products' always uses in-memory (too large for localStorage even without Supabase)
    const useLocalStorageFallback = !isSupabaseConfigured && tableName !== 'products';
    const useInMemoryFallback = !isSupabaseConfigured && tableName === 'products';

    // These hooks are only meaningfully used when Supabase is NOT configured
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
        // --- NO SUPABASE: use local fallbacks ---
        if (!isSupabaseConfigured) {
            setState(useInMemoryFallback ? inMemoryData : localData);
            setIsLoading(false);
            return;
        }

        // --- SUPABASE CONFIGURED: fetch from cloud ---
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                let data = await get(tableName);
                if (data.length === 0 && !seededTables.has(tableName)) {
                    if (tableName !== 'stockStatements' && tableName !== 'pendingSOs') {
                        console.log(`Supabase table '${tableName}' is empty. Seeding with initial data.`);
                        await set(tableName, [], initialData);
                        seededTables.add(tableName);
                        data = await get(tableName);
                    }
                }
                setState(data as T[]);
            } catch (e) {
                console.warn(`Supabase error loading '${tableName}', using in-memory fallback.`, e);
                // When Supabase fails, use in-memory state only — NEVER write to localStorage
                setState(tableName === 'users' ? localData : []);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();

        // --- REAL-TIME SUBSCRIPTIONS ---
        if (!supabase) return;

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
                        console.warn(`Real-time subscription error for '${tableName}'. Live updates may be delayed.`, err);
                    }
                });
        } catch(subError) {
             console.warn(`Failed to initialize subscription for ${tableName}. Real-time updates disabled.`, subError);
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableName]);

    const setValue = useCallback(async (value: SetStateAction<T[]>) => {
        const previousState = stateRef.current;
        const newState = value instanceof Function ? value(previousState!) : value;

        setState(newState); // optimistic update
        
        if (newState === undefined) {
            console.warn('State update resulted in undefined. Aborting persistence.');
            return;
        }

        // --- NO SUPABASE: write to local fallback ---
        if (!isSupabaseConfigured) {
            if (useInMemoryFallback) {
                setInMemoryData(newState);
            } else if (useLocalStorageFallback) {
                try {
                    await setLocalData(newState);
                } catch (e) {
                    if (e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
                        setState(previousState);
                        alert(`Storage Error: Browser local storage is full for '${tableName}'.\n\nPlease configure Supabase to use cloud storage, or clear browser storage via DevTools → Application → Local Storage → Clear All.`);
                    }
                }
            }
            return;
        }

        // --- SUPABASE CONFIGURED: write to cloud only ---
        try {
            await set(tableName, previousState, newState);
            // Success — do NOT write to localStorage. Supabase is the source of truth.
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            const lowerMsg = errorMessage.toLowerCase();

            // Missing table — fall back to in-memory only (not localStorage)
            if (
                lowerMsg.includes('could not find the table') || 
                (lowerMsg.includes('relation') && lowerMsg.includes('does not exist')) ||
                lowerMsg.includes('42p01') || 
                lowerMsg.includes('schema cache') ||
                lowerMsg.includes('client not initialized')
            ) {
                return;
            }

            // Handle localStorage quota exceeded
            if (isQuotaError) {
                console.error(`Browser localStorage is full for '${tableName}'.`, e);
                setState(previousState); // revert
                alert(`Storage Error: Your browser's local storage is full.\n\nThis usually happens because too much data (products, orders, etc.) is being saved locally.\n\nFix: Ensure Supabase is connected — the app will then save to the cloud instead of the browser.\n\nIf Supabase is connected and this still happens, try clearing browser storage: Open DevTools → Application → Local Storage → Clear All.`);
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