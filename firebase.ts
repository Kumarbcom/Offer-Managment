import { db } from './firebaseConfig';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

type CollectionName = 'salesPersons' | 'customers' | 'products' | 'quotations' | 'deliveryChallans';

/**
 * Fetches all documents from a specified Firestore collection.
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
        // Use the document ID from firestore as firebaseId
        return snapshot.docs.map(doc => ({ ...doc.data(), firebaseId: doc.id }));
    } catch (error) {
        console.error(`Failed to fetch data for ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Overwrites an entire Firestore collection with a new set of data.
 * It first deletes all existing documents and then adds the new ones.
 * @param collectionName The name of the collection to update.
 * @param data The new array of data to store in the collection.
 */
export async function set<T extends { id: number }>(collectionName: CollectionName, data: T[]): Promise<void> {
    try {
        const batch = writeBatch(db);
        const collectionRef = collection(db, collectionName);

        const existingDocsSnapshot = await getDocs(collectionRef);
        existingDocsSnapshot.forEach(document => {
            batch.delete(document.ref);
        });

        // Add new documents, using the item's own `id` as the document ID for consistency.
        data.forEach(item => {
            const docRef = doc(db, collectionName, String(item.id));
            const { ...itemData } = item; // create a new object without the potential firebaseId
            batch.set(docRef, itemData);
        });

        await batch.commit();
    } catch (error) {
        console.error(`Failed to save data for ${collectionName}:`, error);
        throw error;
    }
}
