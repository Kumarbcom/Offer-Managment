
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
 * If Firebase is not configured or fails on initial load, it falls back to using the browser's Local Storage.
 * This ensures the application is always usable out-of-the-box.
 */
// FIX: Changed React.SetStateAction to SetStateAction and imported it from 'react'.
export const useOnlineStorage = <T extends {id?: number, name?: string}>(collectionName: CollectionName): [T[] | null, (value: SetStateAction<T[]>) => Promise<void>, boolean, Error | null] => {
    
    // Always initialize local storage hook to follow rules of hooks.
    const initialData = INITIAL_DATA[collectionName] as unknown as T[];
    const [localData, setLocalData] = useLocalStorage<T[]>(collectionName, initialData);

    const [state, setState] = useState<T[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!isFirebaseConfigured) {
            console.warn(`Firebase not configured for '${collectionName}'. Using Local Storage.`);
            setState(localData);
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
                console.warn(`Falling back to Local Storage for '${collectionName}' due to Firebase error.`);
                setState(localData); // Fallback on error
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionName]); // This effect should only run once when the collection name changes.

    // FIX: Changed React.SetStateAction to SetStateAction.
    const setValue = useCallback(async (value: SetStateAction<T[]>) => {
        const previousState = state;
        const valueToStore = value instanceof Function ? value(previousState!) : value;
        
        setState(valueToStore); // Optimistic UI update

        if (!isFirebaseConfigured) {
            await setLocalData(valueToStore);
            return;
        }

        try {
            await set(collectionName, valueToStore);
        } catch (e) {
            console.error(`Firebase error on saving '${collectionName}':`, e);
            setError(e as Error);
            setState(previousState); // Revert optimistic update on failure
            throw e;
        }
    }, [collectionName, state, setLocalData]);
    
    return [state, setValue, isLoading, error];
};
