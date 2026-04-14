
import { useState, useEffect, useCallback, SetStateAction, useRef } from 'react';
import { get, set, toSupabaseTableName } from '../supabase';
import { INITIAL_DATA } from '../initialData';
import { supabase, supabaseConfig } from '../supabaseClient';

type CollectionName = keyof typeof INITIAL_DATA;

const isSupabaseConfigured = supabaseConfig.url && !supabaseConfig.url.includes('YOUR_PROJECT_ID');

/**
 * A hook to manage data persistence with Supabase.
 * Strictly Cloud-only: No local storage persistence is used.
 */
export const useOnlineStorage = <T extends {id?: number | string, name?: string}>(tableName: CollectionName): [T[] | null, (value: SetStateAction<T[]>) => Promise<void>, boolean, Error | null] => {
    
    const initialData = INITIAL_DATA[tableName] as unknown as T[];
    
    // Using simple useState instead of useLocalStorage
    const [state, setState] = useState<T[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        if (!isSupabaseConfigured) {
            console.warn(`Supabase NOT configured for '${tableName}'. Operating in Memory-Only mode (data will be lost on refresh).`);
            setState(initialData);
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                let data = await get(tableName);
                
                // Seed empty tables with initial data if needed
                if (data.length === 0) {
                    if (tableName !== 'stockStatements' && tableName !== 'pendingSOs') {
                        console.log(`Supabase table '${tableName}' is empty. Seeding...`);
                        await set(tableName, [], initialData);
                        data = await get(tableName);
                    }
                }
                
                setState(data as T[]);
            } catch (e) {
                console.error(`Supabase error on loading '${tableName}':`, e);
                // Fallback to initial data in memory if Supabase fails to load
                setState(initialData);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();

        // --- REAL-TIME SUBSCRIPTION ---
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
                .subscribe();
        } catch(subError) {
             console.warn(`Real-time subscription failed for ${tableName}:`, subError);
        }

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [tableName]);

    const setValue = useCallback(async (value: SetStateAction<T[]>) => {
        const previousState = stateRef.current;
        const newState = value instanceof Function ? value(previousState!) : value;

        // Optimistic Update
        setState(newState);
        
        if (!isSupabaseConfigured) return;

        try {
            const savedData = await set(tableName, previousState, newState);
            
            // Sync any server-side generated fields (like IDs)
            if (savedData && Array.isArray(savedData) && savedData.length > 0) {
                setState(current => {
                    const currentMap = new Map((current || []).map(item => [item.id, item]));
                    savedData.forEach(item => {
                        currentMap.set(item.id, item);
                    });
                    return Array.from(currentMap.values());
                });
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`Supabase save error for '${tableName}':`, e);
            
            // Revert state on error since we are not saving locally
            setState(previousState);
            alert(`❌ Cloud Sync Failed: ${errorMessage}\n\nNo local copy was saved. Please ensure your internet is working and RLS policies are fixed.`);
        }
    }, [tableName]);
    
    return [state, setValue, isLoading, error];
};