const DB_NAME = 'OfflinePdfEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'active_session';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save active PDF session (Blob + filename + handle + filePath + state)
 */
export async function saveActiveSession(fileName, buffer, fileHandle = null, documentMeta = {}, filePath = null) {
  try {
    const db = await openDatabase();
    // Convert ArrayBuffer or Uint8Array to a Blob for 100% reliable IndexedDB serialization
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // FileSystemFileHandle is serializable in modern Chromium IndexedDB
    const record = {
      fileName,
      blob,
      handle: fileHandle || null,
      filePath: filePath || null,
      documentMeta,
      timestamp: Date.now(),
    };

    try {
      store.put(record, 'current');
    } catch (putErr) {
      // Fallback in case structured cloning of handle fails in older engine
      store.put({ ...record, handle: null }, 'current');
    }

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('Failed to save session to IndexedDB:', e);
    return false;
  }
}

/**
 * Load active PDF session from IndexedDB after refresh
 */
export async function loadActiveSession() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('current');
    return new Promise((resolve) => {
      request.onsuccess = async () => {
        const result = request.result;
        if (!result) return resolve(null);
        let buffer = null;
        if (result.blob) {
          buffer = await result.blob.arrayBuffer();
        } else if (result.buffer) {
          buffer = result.buffer;
        }
        if (!buffer) return resolve(null);
        resolve({
          fileName: result.fileName,
          buffer,
          handle: result.handle || null,
          filePath: result.filePath || null,
        });
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Clear session
 */
export async function clearActiveSession() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete('current');
  } catch (e) {}
}
