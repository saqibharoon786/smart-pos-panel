const DB_NAME = "bookpos";
const STORE = "snapshot";
const DB_VERSION = 1;

export type LocalSnapshot = {
  products: unknown[];
  popHistory: unknown[];
  sales: unknown[];
  posReturns: unknown[];
  heldSales: unknown[];
  customDepartments: string[];
  dirty: boolean;
  hasRemoteBase: boolean;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSnapshot(): Promise<LocalSnapshot | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get("state");
      request.onsuccess = () => resolve((request.result as LocalSnapshot | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveSnapshot(snapshot: LocalSnapshot): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(snapshot, "state");
    });
  } finally {
    db.close();
  }
}
