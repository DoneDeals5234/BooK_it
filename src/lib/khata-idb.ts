import { KhataBookPayment } from './supabase-khata-book';

const DB_NAME = 'khata_book_local_db';
const STORE_NAME = 'khata_transactions';
const DB_VERSION = 1;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('customer_id', 'customer_id', { unique: false });
        store.createIndex('shop_id', 'shop_id', { unique: false });
      }
    };
  });
}

export async function saveLocalKhataPayment(payment: KhataBookPayment): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(payment);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error saving to IndexedDB", error);
  }
}

export async function getLocalKhataPayments(customerId: string): Promise<KhataBookPayment[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('customer_id');
      const request = index.getAll(customerId);

      request.onsuccess = () => {
        // Sort descending by date
        const results = (request.result as KhataBookPayment[]).sort(
          (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error reading from IndexedDB", error);
    return [];
  }
}

export async function deleteLocalKhataPayment(paymentId: string): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(paymentId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error deleting from IndexedDB", error);
  }
}
