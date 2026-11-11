
import { useState, useEffect, useCallback, SetStateAction, useRef } from 'react';
import { get, set, toSupabaseTableName, mapFromSupabase, liveQuotationSyncChannel } from '../supabase';
import { INITIAL_DATA } from '../initialData';
import { supabase, supabaseConfig } from '../supabaseClient';
import { useLocalStorage } from './useLocalStorage';
import { idbGet, idbSet } from '../utils/idbStorage';

type CollectionName = keyof typeof INITIAL_DATA;

const isSupabaseConfigured = !!(supabaseConfig.url && !supabaseConfig.url.includes('YOUR_PROJECT_ID'));

const seededTables = new Set<CollectionName>();

// Fast in-memory SWR cache across component re-renders
const memoryCache = new Map<string, any>();

// When Supabase is configured, proactively clear localStorage for all known tables
// to recover quota space. localStorage should only be used when Supabase is absent.
// Caching strategy: retain in sessionStorage to enable instant sub-second page loads

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

    // SWR Cache: check in-memory cache, then sessionStorage for instant render
    const [state, setState] = useState<T[] | null>(() => {
        if (memoryCache.has(tableName)) {
            return memoryCache.get(tableName);
        }
        try {
            const cached = sessionStorage.getItem(`cache_${tableName}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                memoryCache.set(tableName, parsed);
                return parsed;
            }
        } catch (_) {}
        return null;
    });
    const [isLoading, setIsLoading] = useState(() => {
        if (memoryCache.has(tableName)) return false;
        try {
            const cached = sessionStorage.getItem(`cache_${tableName}`);
            if (cached) return false;
        } catch (_) {}
        return true;
    });
    const [error, setError] = useState<Error | null>(null);
    
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        // Hydrate from IndexedDB immediately for instant render (<50ms)
        let isMounted = true;
        idbGet<T[]>(`cache_${tableName}`).then(idbData => {
            if (isMounted && idbData && Array.isArray(idbData) && idbData.length > 0) {
                memoryCache.set(tableName, idbData);
                setState(prev => prev ?? idbData);
                setIsLoading(false);
            }
        });

        // --- NO SUPABASE: use local fallbacks ---
        if (!isSupabaseConfigured) {
            setState(useInMemoryFallback ? inMemoryData : localData);
            setIsLoading(false);
            return () => { isMounted = false; };
        }

        // --- SUPABASE CONFIGURED: fetch from cloud ---
        const fetchData = async () => {
            if (!stateRef.current) {
                setIsLoading(true);
            }
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
                if (isMounted) {
                    setState(prev => {
                        if (tableName === 'quotations') {
                            const current = prev || [];
                            const map = new Map<number, any>();
                            // Full DB fetch
                            (data as any[]).forEach(item => { if (item && item.id) map.set(item.id, item); });
                            // Keep any newest local items in case of in-flight changes
                            current.forEach((item: any) => { if (item && item.id && !map.has(item.id)) map.set(item.id, item); });
                            const merged = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
                            memoryCache.set(tableName, merged);
                            idbSet(`cache_${tableName}`, merged);
                            return merged as T[];
                        }
                        memoryCache.set(tableName, data);
                        idbSet(`cache_${tableName}`, data);
                        return data as T[];
                    });
                }
                // Do not write quotations or products to sessionStorage to prevent QuotaExceededError (5MB limit)
                if (tableName !== 'quotations' && tableName !== 'products') {
                    try {
                        sessionStorage.setItem(`cache_${tableName}`, JSON.stringify(data));
                    } catch (_) {}
                }
            } catch (e) {
                console.warn(`Supabase error loading '${tableName}', retaining local/cached fallback.`, e);
                setError(e as Error);
                // When Supabase fails (e.g. quota limit/timeout), NEVER wipe out existing data!
                // Attempt to hydrate from IndexedDB/sessionStorage if state is currently empty
                if (isMounted) {
                    if (!stateRef.current || (Array.isArray(stateRef.current) && stateRef.current.length === 0)) {
                        idbGet<T[]>(`cache_${tableName}`).then(idbData => {
                            if (isMounted && idbData && Array.isArray(idbData) && idbData.length > 0) {
                                setState(idbData);
                                memoryCache.set(tableName, idbData);
                            } else if (tableName === 'users') {
                                setState(localData);
                            }
                        }).catch(() => {
                            if (isMounted && tableName === 'users') setState(localData);
                        });
                    }
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };
        fetchData();

        // --- REAL-TIME BROADCAST & POSTGRES_CHANGES ---
        if (!supabase) return;

        const supabaseTableName = toSupabaseTableName(tableName);
        const channelName = `table-changes-${tableName}-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
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
                                if (!currentState.some(item => (item as any)[primaryKey] === (newRecord as any)[primaryKey])) {
                                    setState(prev => {
                                        const updated = [newRecord, ...(prev || [])];
                                        memoryCache.set(tableName, updated);
                                        idbSet(`cache_${tableName}`, updated);
                                        return updated;
                                    });
                                }
                                break;
                            }
                            case 'UPDATE': {
                                const updatedRecord = mapFromSupabase(tableName, payload.new) as T;
                                setState(prev => {
                                    const updated = (prev || []).map(item =>
                                        (item as any)[primaryKey] === (updatedRecord as any)[primaryKey] ? updatedRecord : item
                                    );
                                    memoryCache.set(tableName, updated);
                                    idbSet(`cache_${tableName}`, updated);
                                    return updated;
                                });
                                break;
                            }
                            case 'DELETE': {
                                const oldRecord = payload.old as Partial<T>;
                                const recordIdToDelete = (oldRecord as any)[primaryKey];
                                setState(prev => {
                                    const updated = (prev || []).filter(item => (item as any)[primaryKey] !== recordIdToDelete);
                                    memoryCache.set(tableName, updated);
                                    idbSet(`cache_${tableName}`, updated);
                                    return updated;
                                });
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

        // Shared broadcast listener for instant cross-device updates without waiting for postgres_changes
        let broadcastListener: any = null;
        if (tableName === 'quotations' && liveQuotationSyncChannel) {
            broadcastListener = (msg: any) => {
                if (msg && msg.payload && msg.payload.id) {
                    const incoming = msg.payload as T;
                    console.log('⚡ Received peer quotation update via broadcast:', (incoming as any).id, (incoming as any).preparedBy);
                    setState(prev => {
                        const current = prev || [];
                        const exists = current.some(item => (item as any).id === (incoming as any).id);
                        const updated = exists
                            ? current.map(item => (item as any).id === (incoming as any).id ? incoming : item)
                            : [incoming, ...current];
                        memoryCache.set('quotations', updated);
                        idbSet('cache_quotations', updated);
                        return updated;
                    });
                }
            };
            liveQuotationSyncChannel.on('broadcast', { event: 'quotation_updated' }, broadcastListener);
        }

        // Real-time subscriptions handle live changes. Refresh once when the tab regains focus.
        let removeWindowListeners: (() => void) | undefined;

        if (tableName === 'quotations') {
            const syncTopQuotations = async () => {
                if (!isMounted || document.visibilityState === 'hidden') return;
                try {
                    const { data, error } = await supabase
                        .from('quotations')
                        .select('id, status, comments, quotation_date, quotationDate, enquiry_date, enquiryDate, customer_id, customerId, sales_person_id, salesPersonId, contact_person, contactPerson, contact_number, contactNumber, other_terms, otherTerms, payment_terms, paymentTerms, prepared_by, preparedBy, products_brand, productsBrand, mode_of_enquiry, modeOfEnquiry, other_terms, otherTerms, payment_terms, paymentTerms, status, comments, details, gst_added, gstAdded')
                        .order('id', { ascending: false })
                        .limit(30);
                    if (error) throw error;
                    const freshTop = (data || []).map((q: any) => mapFromSupabase('quotations', q));
                    if (freshTop.length > 0 && isMounted) {
                        setState(prev => {
                            const list = prev || [];
                            const map = new Map<number, any>();
                            list.forEach((q: any) => { if (q && q.id) map.set(q.id, q); });
                            freshTop.forEach((q: any) => map.set(q.id, q));
                            const merged = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
                            memoryCache.set('quotations', merged);
                            idbSet('cache_quotations', merged);
                            return merged as T[];
                        });
                    }
                } catch (e) {
                    console.warn('Quotation focus refresh failed:', e);
                }
            };

            const handleFocusOrVisible = () => {
                if (document.visibilityState !== 'hidden') syncTopQuotations();
            };

            const handleCustomSync = () => {
                syncTopQuotations();
            };

            window.addEventListener('focus', handleFocusOrVisible);
            window.addEventListener('visibilitychange', handleFocusOrVisible);
            window.addEventListener('sync_quotations_requested', handleCustomSync);

            removeWindowListeners = () => {
                window.removeEventListener('focus', handleFocusOrVisible);
                window.removeEventListener('visibilitychange', handleFocusOrVisible);
                window.removeEventListener('sync_quotations_requested', handleCustomSync);
            };
        }

        return () => {
            isMounted = false;
            if (channel) supabase.removeChannel(channel);
            if (removeWindowListeners) removeWindowListeners();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableName]);

    const setValue = useCallback(async (value: SetStateAction<T[]>) => {
        const previousState = stateRef.current;
        // Use a safe fallback for the previous state if it hasn't loaded yet
        const safePrev = previousState || initialData || [];
        const newState = value instanceof Function ? value(safePrev as T[]) : value;

        setState(newState); // optimistic update
        memoryCache.set(tableName, newState);
        idbSet(`cache_${tableName}`, newState);
        
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

            console.error(`Supabase error on saving '${tableName}':`, e);
            
            // Revert optimistic update on failure for genuine errors (network, validation, etc)
            setState(previousState);
            
            // Notify user of the failure but do not crash the app.
            alert(`Failed to save changes for ${tableName}. Your changes have been reverted. Please check your connection and try again.\n\nError: ${errorMessage}`);
        }
    }, [tableName, isSupabaseConfigured, useInMemoryFallback, setLocalData, setInMemoryData]);
    
    return [state, setValue, isLoading, error];
};