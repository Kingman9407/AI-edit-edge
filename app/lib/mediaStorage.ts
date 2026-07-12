/**
 * mediaStorage.ts
 * ----------------
 * Stores large binary File objects (videos, audios) and project edits in IndexedDB.
 * Since localStorage has a 5MB limit and cannot store Blobs/Files directly,
 * we use IndexedDB to cache the user's uploaded media so it survives page reloads.
 */

const DB_NAME = "AIEditDatabase";
const DB_VERSION = 1;
const STORE_MEDIA = "project_media";
const STORE_EDITS = "project_edits";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not supported in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: "projectId" });
      }
      if (!db.objectStoreNames.contains(STORE_EDITS)) {
        db.createObjectStore(STORE_EDITS, { keyPath: "projectId" });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// ─── MEDIA (Video/Audio Files) ─────────────────────────────────────────────

export interface ProjectMediaRecord {
  projectId: string;
  videoFiles: File[];
  audioFiles: File[];
}

export async function saveProjectMedia(
  projectId: string,
  videoFiles: File[],
  audioFiles: File[] = []
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, "readwrite");
    const store = tx.objectStore(STORE_MEDIA);
    
    const record: ProjectMediaRecord = { projectId, videoFiles, audioFiles };
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadProjectMedia(
  projectId: string
): Promise<ProjectMediaRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, "readonly");
    const store = tx.objectStore(STORE_MEDIA);
    const request = store.get(projectId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(request.error);
  });
}

// ─── EDITS (Timeline cuts, etc.) ───────────────────────────────────────────

export interface ProjectEditsRecord {
  projectId: string;
  edits: any[]; // EditSegment array
}

export async function saveProjectEdits(
  projectId: string,
  edits: any[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EDITS, "readwrite");
    const store = tx.objectStore(STORE_EDITS);
    
    const record: ProjectEditsRecord = { projectId, edits };
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadProjectEdits(
  projectId: string
): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EDITS, "readonly");
    const store = tx.objectStore(STORE_EDITS);
    const request = store.get(projectId);

    request.onsuccess = () => {
      resolve(request.result?.edits || []);
    };
    request.onerror = () => reject(request.error);
  });
}
