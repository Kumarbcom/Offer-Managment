import React, { useState, useEffect, useCallback } from 'react';
import { MOCK_SALES_PERSONS, MOCK_CUSTOMERS, MOCK_PRODUCTS, MOCK_QUOTATIONS, MOCK_DELIVERY_CHALLANS } from '../mockData';

const initialDataMap = {
    salesPersons: MOCK_SALES_PERSONS,
    customers: MOCK_CUSTOMERS,
    products: MOCK_PRODUCTS,
    quotations: MOCK_QUOTATIONS,
    deliveryChallans: MOCK_DELIVERY_CHALLANS,
};

type CollectionName = keyof typeof initialDataMap;

export const useOnlineStorage = <T extends {id: number}>(collectionName: CollectionName): [T[] | null, (value: React.SetStateAction<T[]>) => Promise<void>, boolean, Error | null] => {
    const [storedValue, setStoredValue] = useState<T[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            try {
                // Directly use mock data as the online storage is not configured.
                const data = initialDataMap[collectionName] as unknown as T[];
                setStoredValue(data);
            } catch (e) {
                setError(e as Error);
            } finally {
                setIsLoading(false);
            }
        }, 500); // Simulate network delay

        return () => clearTimeout(timer);
    }, [collectionName]);

    const setValue = useCallback(async (value: React.SetStateAction<T[]>) => {
        // This function will now only update the state in memory.
        if (storedValue === null) {
            console.warn("Attempted to set value before storage was loaded.");
            return;
        }
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        // The original implementation returned a promise, so we do the same.
        return Promise.resolve();
    }, [storedValue]);
    
    return [storedValue, setValue, isLoading, error];
};
