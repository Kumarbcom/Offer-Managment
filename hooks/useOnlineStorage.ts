
import { useState, useEffect, useCallback, SetStateAction, useRef } from 'react';
import { get, set, toSupabaseTableName, mapFromSupabase, fetchLatestQuotations, fetchQuotationsBatch, fetchQuotationStatuses, fetchSingleQuotation, updateQuotationField, liveQuotationSyncChannel, isDataSaverEnabled, cacheCustomerLocally } from '../supabase';
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
        let isMounted = true;

        const syncTableData = async () => {
            // 1. Instantly retrieve from memory cache or IndexedDB (sub-50ms)
            let cached: any[] | null = memoryCache.get(tableName) || null;
            if (!cached || !Array.isArray(cached) || cached.length === 0) {
                try {
                    const idbData = await idbGet<T[]>(`cache_${tableName}`);
                    if (idbData && Array.isArray(idbData) && idbData.length > 0) {
                        cached = idbData;
                        memoryCache.set(tableName, cached);
                    }
                } catch (_) {}
            }

            if (tableName === 'quotations' && cached) {
                cached = cached.filter((item: any) => !(item && item.id === 1 && String(item.quotationDate || item.quotation_date || '').startsWith('2026-11-18')));
            }

            // Immediately display cached data (instant render, zero loading delay)
            if (cached && cached.length > 0 && isMounted) {
                setState(cached as T[]);
                setIsLoading(false);
            }

            // If Supabase is not configured, fall back to local/in-memory
            if (!isSupabaseConfigured) {
                if (!cached) {
                    setState(useInMemoryFallback ? inMemoryData : localData);
                }
                setIsLoading(false);
                return;
            }

            // Supabase is configured: perform ultra-lean delta synchronization
            try {
                if (!supabase) return;

                // --- QUOTATIONS EGRESS OPTIMIZATION ---
                if (tableName === 'quotations') {
                    const cachedQuotes = (cached as any[]) || [];
                    const maxCachedId = cachedQuotes.reduce((m, q) => Math.max(m, Number(q?.id) || 0), 0);

                    // If browser already has quotation history cached (1000+ quotes)
                    if (cachedQuotes.length >= 1000 && maxCachedId > 0) {
                        // 1. Ultra-lean check: check highest quotation ID in DB (80 bytes egress!)
                        const { data: topRow } = await supabase.from('quotations')
                            .select('id')
                            .order('id', { ascending: false })
                            .limit(1);

                        const highestRemoteId = topRow?.[0]?.id || 0;

                        // Only download if new quotations were created!
                        if (highestRemoteId > maxCachedId) {
                            const { data: newQuotes } = await supabase.from('quotations')
                                .select('*')
                                .gt('id', maxCachedId)
                                .order('id', { ascending: false });

                            if (newQuotes && newQuotes.length > 0 && isMounted) {
                                const mappedNew = newQuotes.map(q => mapFromSupabase('quotations', q));
                                setState(prev => {
                                    const current = prev || [];
                                    const map = new Map<number, any>();
                                    current.forEach((item: any) => { if (item && item.id) map.set(item.id, item); });
                                    mappedNew.forEach((item: any) => { if (item && item.id) map.set(item.id, item); });
                                    const merged = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
                                    memoryCache.set(tableName, merged);
                                    idbSet(`cache_${tableName}`, merged);
                                    return merged as T[];
                                });
                            }
                        }

                        // 2. Ultra-lean status sync: only check top 25 recent items (id, status, updated_at) ~ 1 KB
                        const { data: recentStatuses } = await supabase.from('quotations')
                            .select('id, status, updated_at')
                            .order('id', { ascending: false })
                            .limit(25);

                        if (recentStatuses && recentStatuses.length > 0 && isMounted) {
                            let statusChanged = false;
                            const statusMap = new Map<number, string>();
                            recentStatuses.forEach((r: any) => statusMap.set(r.id, r.status));

                            setState(prev => {
                                if (!prev) return prev;
                                const updated = prev.map((q: any) => {
                                    if (statusMap.has(q.id) && q.status !== statusMap.get(q.id)) {
                                        statusChanged = true;
                                        return { ...q, status: statusMap.get(q.id) };
                                    }
                                    return q;
                                });
                                if (statusChanged) {
                                    memoryCache.set(tableName, updated);
                                    idbSet(`cache_${tableName}`, updated);
                                    return updated as T[];
                                }
                                return prev;
                            });
                        }

                        if (isMounted) setIsLoading(false);
                        return; // Finished! Over 99.9% egress saved!
                    }

                    // If local cache doesn't have quotation history yet (first time browser visits):
                    const latest = await fetchLatestQuotations(150);
                    if (latest && latest.length > 0 && isMounted) {
                        setState(prev => {
                            const current = prev || [];
                            const map = new Map<number, any>();
                            current.forEach((item: any) => { if (item && item.id) map.set(item.id, item); });
                            latest.forEach((item: any) => { if (item && item.id) map.set(item.id, item); });
                            const merged = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
                            memoryCache.set(tableName, merged);
                            idbSet(`cache_${tableName}`, merged);
                            return merged as T[];
                        });
                        setIsLoading(false);
                    }

                    // Background stream remainder once to populate local cache
                    setTimeout(async () => {
                        let offset = 150;
                        const batchSize = 150;
                        while (isMounted) {
                            try {
                                const olderBatch = await fetchQuotationsBatch(offset, batchSize);
                                if (!olderBatch || olderBatch.length === 0 || !isMounted) break;
                                setState(prev => {
                                    const current = prev || [];
                                    const map = new Map<number, any>();
                                    current.forEach((item: any) => { if (item && item.id) map.set(item.id, item); });
                                    olderBatch.forEach((item: any) => { if (item && item.id) map.set(item.id, item); });
                                    const merged = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
                                    memoryCache.set(tableName, merged);
                                    idbSet(`cache_${tableName}`, merged);
                                    return merged as T[];
                                });
                                if (olderBatch.length < batchSize) break;
                                offset += olderBatch.length;
                                await new Promise(r => setTimeout(r, 600));
                            } catch (_) {
                                break;
                            }
                        }
                    }, 1000);

                    return;
                }

                // --- CUSTOMERS EGRESS OPTIMIZATION ---
                if (tableName === 'customers') {
                    const cachedCustomers = (cached as any[]) || [];
                    if (cachedCustomers.length > 0) {
                        // Check customer count via HEAD request (0 bytes body payload!)
                        const { count: remoteCount } = await supabase.from('customers').select('id', { count: 'exact', head: true });
                        const maxCachedId = cachedCustomers.reduce((m, c) => Math.max(m, Number(c?.id) || 0), 0);

                        // Only download if new customers were added!
                        if (remoteCount && remoteCount > cachedCustomers.length) {
                            const { data: newCusts } = await supabase.from('customers')
                                .select('*')
                                .gt('id', maxCachedId)
                                .order('id', { ascending: false });

                            if (newCusts && newCusts.length > 0 && isMounted) {
                                const mapped = newCusts.map(c => mapFromSupabase('customers', c));
                                const merged = [...mapped, ...cachedCustomers];
                                memoryCache.set('customers', merged);
                                idbSet('cache_customers', merged);
                                setState(merged as T[]);
                            }
                        }
                        if (isMounted) setIsLoading(false);
                        return; // Finished! Zero egress wasted!
                    }

                    // First time loading customers: fetch and cache locally
                    const data = await get('customers');
                    if (isMounted && data.length > 0) {
                        setState(data as T[]);
                        memoryCache.set('customers', data);
                        idbSet('cache_customers', data);
                        setIsLoading(false);
                    }
                    return;
                }

                // --- OTHER SMALL TABLES (users, salesPersons) ---
                const data = await get(tableName);
                if (isMounted && data.length > 0) {
                    setState(data as T[]);
                    memoryCache.set(tableName, data);
                    idbSet(`cache_${tableName}`, data);
                    try { sessionStorage.setItem(`cache_${tableName}`, JSON.stringify(data)); } catch (_) {}
                    setIsLoading(false);
                }
            } catch (e) {
                console.warn(`Supabase error syncing '${tableName}', retaining local cache:`, e);
                setError(e as Error);
                if (isMounted) setIsLoading(false);
            }
        };

        syncTableData();

        // --- REAL-TIME BROADCAST & POSTGRES_CHANGES ---
        if (!supabase) return;

        const supabaseTableName = toSupabaseTableName(tableName);
        const primaryKey = tableName === 'users' ? 'name' : 'id';

        let channel: any;
        // EGRESS OPTIMIZATION: For 'quotations', we use lightweight Broadcast and status polling.
        // We DO NOT subscribe to postgres_changes for quotations, because postgres_changes decodes WAL
        // and broadcasts entire rows with large details JSONB over WebSockets, consuming excessive egress.
        if (tableName !== 'quotations') {
            const channelName = `changes-${tableName}`;
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
            let lastSyncTime = Date.now();
            const syncTopQuotations = async () => {
                if (!isMounted || document.visibilityState === 'hidden') return;
                try {
                    const freshTop = await fetchLatestQuotations(30);
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
                    lastSyncTime = Date.now();
                } catch (e) {
                    console.warn('Quotation focus refresh failed:', e);
                }
            };

            const handleFocusOrVisible = () => {
                // When Data Saver is ON, do NOT auto-refetch on tab focus to save egress
                if (isDataSaverEnabled()) return;
                // Throttle: only refetch if at least 5 minutes have elapsed since last sync
                if (Date.now() - lastSyncTime < 300000) return;
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
            if (tableName === 'quotations') {
                // Quotations are saved directly to Supabase via `upsertQuotation` in QuotationForm.
                // Do NOT call set('quotations') to avoid double-uploading heavy quotation JSON and false revert errors.
                // We only handle deletions and quick status/comment updates from QuotationManager or CalendarView here.
                const prevList = (previousState || []) as any[];
                const newList = (newState || []) as any[];
                const prevMap = new Map<number, any>(prevList.map(q => [q.id, q]));
                const newMap = new Map<number, any>(newList.map(q => [q.id, q]));

                // Detect deletions
                const toDelete: number[] = [];
                for (const id of prevMap.keys()) {
                    if (!newMap.has(id) && typeof id === 'number' && id > 0) {
                        toDelete.push(id);
                    }
                }
                if (toDelete.length > 0 && supabase) {
                    await supabase.from('quotations').delete().in('id', toDelete);
                }

                // Detect quick status/comment/salesPerson/contact changes
                for (const [id, newItem] of newMap.entries()) {
                    const prevItem = prevMap.get(id);
                    if (prevItem && typeof id === 'number' && id > 0) {
                        const statusChanged = prevItem.status !== newItem.status;
                        const commentChanged = prevItem.comments !== newItem.comments;
                        const spChanged = prevItem.salesPersonId !== newItem.salesPersonId;
                        const cpChanged = prevItem.contactPerson !== newItem.contactPerson;
                        const cnChanged = prevItem.contactNumber !== newItem.contactNumber;
                        if (statusChanged || commentChanged || spChanged || cpChanged || cnChanged) {
                            await updateQuotationField(id, {
                                status: newItem.status,
                                comments: newItem.comments,
                                salesPersonId: newItem.salesPersonId,
                                contactPerson: newItem.contactPerson,
                                contactNumber: newItem.contactNumber
                            });
                        }
                    }
                }
                return;
            }

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