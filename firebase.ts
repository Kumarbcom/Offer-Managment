import { db } from './firebaseConfig';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

type CollectionName = 'salesPersons' | 'customers' | 'products' | 'quotations' | 'deliveryChallans' | 'users';

/**
 * Fetches all documents from a specified Firestore collection.
 * It ensures that the local object's `id` or `name` is correctly populated from the Firestore document ID.
 * @param collectionName The name of the collection to fetch.
 * @returns A promise that resolves to an array of documents.
 */
export async function get(collectionName: CollectionName): Promise<any[]> {
    try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        if (snapshot.empty) {
            return [];
        }
        
        return snapshot.docs.map(doc => {
            const data = doc.data();
            const docId = doc.id;

            if (collectionName === 'users') {
                 // For users, ensure the 'name' field matches the document ID
                 return { ...data, name: docId };
            } else {
                // For other collections, ensure the 'id' field matches the document ID (parsed as a number)
                const numericId = parseInt(docId, 10);
                if (isNaN(numericId)) {
                    console.warn(`Document in ${collectionName} has a non-numeric ID '${docId}'. Skipping.`);
                    return null;
                }
                return { ...data, id: numericId };
            }
        }).filter(item => item !== null); // Filter out any items that were skipped
    } catch (error) {
        console.error(`Failed to fetch data for ${collectionName}:`, error);
        throw error;
    }
}


/**
 * Efficiently synchronizes a local array of data with a Firestore collection.
 * It calculates the difference between the previous and new state and performs only the necessary create, update, or delete operations.
 * This avoids a read-before-write pattern, making the operation more robust.
 * @param collectionName The name of the collection to update.
 * @param previousData The state of the data before the change.
 * @param newData The new array of data that represents the desired state of the collection.
 */
export async function set<T extends { id?: number, name?: string }>(collectionName: CollectionName, previousData: T[] | null, newData: T[]): Promise<void> {
    try {
        const batch = writeBatch(db);

        const previousDataIds = new Set<string>();
        if (previousData) {
             previousData.forEach(item => {
                const docId = collectionName === 'users' ? String(item.name) : String(item.id);
                if (docId && docId !== 'undefined') {
                    previousDataIds.add(docId);
                }
            });
        }
        
        const newDataIds = new Set<string>();
        newData.forEach(item => {
            const docId = collectionName === 'users' ? String(item.name) : String(item.id);
            if (docId && docId !== 'undefined') {
                newDataIds.add(docId);
            }
        });

        // 1. Determine and queue documents for deletion.
        previousDataIds.forEach(id => {
            if (!newDataIds.has(id)) {
                const docRef = doc(db, collectionName, id);
                batch.delete(docRef);
            }
        });

        // 2. Queue documents for creation or update.
        newData.forEach(item => {
            const docId = collectionName === 'users' ? String(item.name) : String(item.id);
            if (!docId || docId === 'undefined') {
                console.warn("Skipping item without an id/name:", item);
                return;
            }

            const docRef = doc(db, collectionName, docId);
            
            // Prepare the data for Firestore by removing the local ID property.
            let itemData: any;
            if (collectionName === 'users') {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { name, ...rest } = item as any;
                itemData = rest;
            } else {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, ...rest } = item as any;
                itemData = rest;
            }
            
            batch.set(docRef, itemData);
        });

        await batch.commit();
    } catch (error) {
        console.error(`Failed to save data for ${collectionName}:`, error);
        throw error;
    }
}
