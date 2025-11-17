import { db } from './firebaseConfig';
import { collection, getDocs, doc, writeBatch, query, orderBy, limit, startAfter, where, documentId } from 'firebase/firestore';
import type { Product } from './types';

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

        // Create maps for efficient lookups. Key is the document ID.
        const previousDataMap = new Map<string, T>();
        if (previousData) {
            previousData.forEach(item => {
                const docId = collectionName === 'users' ? String(item.name) : String(item.id);
                if (docId && docId !== 'undefined') {
                    previousDataMap.set(docId, item);
                }
            });
        }
        
        const newDataMap = new Map<string, T>();
        newData.forEach(item => {
            const docId = collectionName === 'users' ? String(item.name) : String(item.id);
            if (docId && docId !== 'undefined') {
                newDataMap.set(docId, item);
            }
        });

        // 1. Queue DELETES for items in previousData but not in newData.
        for (const id of previousDataMap.keys()) {
            if (!newDataMap.has(id)) {
                const docRef = doc(db, collectionName, id);
                batch.delete(docRef);
            }
        }

        // 2. Queue SETS for new or changed items in newData.
        for (const [id, newItem] of newDataMap.entries()) {
            const prevItem = previousDataMap.get(id);

            // Function to get the data payload for Firestore (without local id/name).
            const getItemData = (item: T) => {
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
                return itemData;
            };

            // If the item is new, or if it has changed (checked via stringify), add a set operation to the batch.
            if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(newItem)) {
                const docRef = doc(db, collectionName, id);
                const newItemData = getItemData(newItem);
                batch.set(docRef, newItemData);
            }
        }

        await batch.commit();
    } catch (error) {
        console.error(`Failed to save data for ${collectionName}:`, error);
        throw error;
    }
}

// --- New Scalable Functions for Products ---

interface ProductQueryOptions {
    pageLimit: number;
    startAfterDoc?: any;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    filters: {
        partNo?: string;
        description?: string;
    };
}

export async function getProductsPaginated(options: ProductQueryOptions) {
    const { pageLimit, startAfterDoc, sortBy, sortOrder, filters } = options;
    const collectionRef = collection(db, 'products');

    let queries = [];

    // NOTE: Firestore doesn't support case-insensitive "contains" search natively.
    // This implements a "starts with" search.
    if (filters.partNo) {
        queries.push(where('partNo', '>=', filters.partNo.toUpperCase()));
        queries.push(where('partNo', '<=', filters.partNo.toUpperCase() + '\uf8ff'));
    }
    if (filters.description) {
        queries.push(where('description', '>=', filters.description));
        queries.push(where('description', '<=', filters.description + '\uf8ff'));
    }

    // Add sorting. Note: If you filter on a field, you must sort by it first.
    // We sort by the main sort field, and add partNo as a secondary sort for consistent ordering.
    const effectiveSortBy = (filters.partNo && sortBy !== 'partNo') ? 'partNo' : sortBy;
    queries.push(orderBy(effectiveSortBy, sortOrder));
    if (sortBy !== effectiveSortBy) {
         queries.push(orderBy(sortBy, sortOrder));
    }

    if (startAfterDoc) {
        queries.push(startAfter(startAfterDoc));
    }
    queries.push(limit(pageLimit));
    
    const finalQuery = query(collectionRef, ...queries);

    const snapshot = await getDocs(finalQuery);
    const products = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: parseInt(docSnap.id, 10) } as Product));
    const lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

    return { products, lastVisibleDoc };
}

export async function addProductsBatch(products: Product[]): Promise<void> {
    const batch = writeBatch(db);
    products.forEach(product => {
        const docRef = doc(db, 'products', String(product.id));
        const { id, ...productData } = product;
        batch.set(docRef, productData);
    });
    await batch.commit();
}

export async function deleteProductsBatch(productIds: number[]): Promise<void> {
    const batch = writeBatch(db);
    productIds.forEach(id => {
        const docRef = doc(db, 'products', String(id));
        batch.delete(docRef);
    });
    await batch.commit();
}

export async function updateProduct(product: Product): Promise<void> {
    const docRef = doc(db, 'products', String(product.id));
    const { id, ...productData } = product;
    const batch = writeBatch(db);
    batch.set(docRef, productData);
    await batch.commit();
}
