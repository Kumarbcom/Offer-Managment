import { useState, useEffect, useCallback, SetStateAction } from 'react';
import { get, set } from '../firebase';
import { INITIAL_DATA } from '../initialData';
import { firebaseConfig } from '../firebaseConfig';
import { useLocalStorage } from './useLocalStorage';

type CollectionName = keyof typeof INITIAL_DATA;

// Check if the Firebase config has been filled out.
const isFirebaseConfigured = firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID";

// A flag to ensure seeding only happens once per collection per session for Firebase.
const seededCollections = new Set<CollectionName>();

/**
 * A hook to manage data persistence.
 * It attempts to use Firebase Firestore if configured.
 * If Firebase is not configured or fails on initial load, it falls back to a different storage strategy:
 * - For the 'products' collection, it uses in-memory state to avoid local storage quota errors.
 * - For all other collections, it uses the browser's Local Storage.
 * This ensures the application is always usable out-of-the-box, even with large product catalogs.
 */
export const useOnlineStorage = <T extends {id?: number, name?: string}>(collectionName: CollectionName): [T[] | null, (value: SetStateAction<T[]>) => Promise<void>, boolean, Error | null] => {
    
    const initialData = INITIAL_DATA[collectionName] as unknown as T[];
    const useInMemoryFallback = collectionName === 'products' && !isFirebaseConfigured;

    const [localData, setLocalData] = useLocalStorage<T[]>(collectionName, initialData);
    const [inMemoryData, setInMemoryData] = useState<T[]>(initialData);

    const [state, setState] = useState<T[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!isFirebaseConfigured) {
            if (useInMemoryFallback) {
                // Using in-memory storage for products when Firebase is not configured.
                setState(inMemoryData);
            } else {
                // Using local storage for other collections.
                setState(localData);
            }
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                let data = await get(collectionName);
                if (data.length === 0 && !seededCollections.has(collectionName)) {
                    console.log(`Firebase collection '${collectionName}' is empty. Seeding with initial data.`);
                    await set(collectionName, initialData);
                    seededCollections.add(collectionName);
                    data = await get(collectionName); // Re-fetch to get data with firebase IDs
                }
                setState(data as T[]);
            } catch (e) {
                console.error(`Firebase error on loading '${collectionName}':`, e);
                setError(e as Error);
                // Fallback to local/in-memory storage on error
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
    // This effect should only run once when the hook mounts for a specific collection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionName]);

    const setValue = useCallback(async (value: SetStateAction<T[]>) => {
        let previousState: T[] | null = null;
        let newState: T[] | undefined;

        // Use the functional update form to get the most recent state for the update.
        // This also allows us to capture both old and new states for the async operation.
        setState(current => {
            previousState = current;
            newState = value instanceof Function ? value(current!) : value;
            return newState;
        });

        // The state update is queued, but the new value is available immediately.
        // We must check if it's defined before proceeding with persistence.
        if (newState === undefined) {
            console.warn('State update resulted in an undefined value. Aborting persistence.');
            return;
        }

        if (!isFirebaseConfigured) {
            if (useInMemoryFallback) {
                setInMemoryData(newState);
            } else {
                await setLocalData(newState);
            }
            return;
        }

        try {
            await set(collectionName, newState);
        } catch (e) {
            console.error(`Firebase error on saving '${collectionName}':`, e);
            setError(e as Error);
            // Revert the optimistic UI update if the async operation fails.
            setState(previousState);
            throw e;
        }
    }, [collectionName, useInMemoryFallback, setLocalData, setInMemoryData]);
    
    return [state, setValue, isLoading, error];
};
