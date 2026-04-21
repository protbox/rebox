const DB_NAME = "rebox-local-samples";
const STORE_NAME = "samples";
const DB_VERSION = 1;
const LOCALSTORAGE_PREFIX = "rebox-local-name-";

export const LOCAL_SAMPLE_URL_PREFIX = "rebox-local://";

interface StoredSample {
    data: ArrayBuffer;
    filename: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (dbPromise != null) return dbPromise;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return dbPromise;
}

export async function storeLocalSample(id: string, data: ArrayBuffer, filename: string): Promise<void> {
    const db = await openDb();
    const record: StoredSample = { data, filename };
    try {
        localStorage.setItem(LOCALSTORAGE_PREFIX + id, filename);
    } catch (e) {
        // localStorage full or unavailable; filename lookup will fall back to IndexedDB-less behavior
    }
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(record, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getLocalSample(id: string): Promise<ArrayBuffer | null> {
    const db = await openDb();
    return new Promise<ArrayBuffer | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(id);
        request.onsuccess = () => {
            const record = request.result as StoredSample | undefined;
            if (record == null) { resolve(null); return; }
            try {
                localStorage.setItem(LOCALSTORAGE_PREFIX + id, record.filename);
            } catch (e) { /* ignore */ }
            resolve(record.data);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function getLocalSampleWithFilename(id: string): Promise<{ data: ArrayBuffer; filename: string } | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(id);
        request.onsuccess = () => {
            const record = request.result as StoredSample | undefined;
            if (record == null) { resolve(null); return; }
            resolve({ data: record.data, filename: record.filename });
        };
        request.onerror = () => reject(request.error);
    });
}

export async function hasLocalSample(id: string): Promise<boolean> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getKey(id);
        request.onsuccess = () => resolve(request.result != null);
        request.onerror = () => reject(request.error);
    });
}

export function getLocalSampleFilename(id: string): string | null {
    try {
        return localStorage.getItem(LOCALSTORAGE_PREFIX + id);
    } catch (e) {
        return null;
    }
}

export function generateLocalSampleId(): string {
    return "ls-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}