
import React, { useState, useCallback } from 'react';

export const useLocalStorage = <T,>(key: string, initialValue: T): [T, (value: React.SetStateAction<T>) => Promise<void>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = useCallback(async (value: React.SetStateAction<T>) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
      if (error instanceof Error && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
          alert("Storage Limit Reached: Your local browser storage is full. Please clear some data or ensure Supabase connectivity to save properly.");
      }
    }
  }, [key, storedValue]);
  
  return [storedValue, setValue];
};
