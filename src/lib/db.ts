import type { KnowledgeDoc, Chunk, Conversation } from './types';

const DB_NAME = 'atlas-support-ai';
const DB_VERSION = 1;
const STORE_DOCS = 'documents';
const STORE_CHUNKS = 'chunks';
const STORE_CONVERSATIONS = 'conversations';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) db.createObjectStore(STORE_CHUNKS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const req = fn(transaction.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function txAll<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDB().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const req = fn(transaction.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }));
}

export async function saveDoc(doc: KnowledgeDoc): Promise<void> {
  await tx(STORE_DOCS, 'readwrite', (s) => s.put(doc));
}

export async function getDocs(): Promise<KnowledgeDoc[]> {
  return txAll<KnowledgeDoc[]>(STORE_DOCS, 'readonly', (s) => s.getAll());
}

export async function deleteDoc(id: string): Promise<void> {
  await tx(STORE_DOCS, 'readwrite', (s) => s.delete(id));
  const chunks = await getChunksByDoc(id);
  const db = await openDB();
  const transaction = db.transaction(STORE_CHUNKS, 'readwrite');
  const store = transaction.objectStore(STORE_CHUNKS);
  for (const chunk of chunks) store.delete(chunk.id);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveChunks(chunks: Chunk[]): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(STORE_CHUNKS, 'readwrite');
  const store = transaction.objectStore(STORE_CHUNKS);
  for (const chunk of chunks) store.put(chunk);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getChunksByDoc(docId: string): Promise<Chunk[]> {
  const all = await txAll<Chunk[]>(STORE_CHUNKS, 'readonly', (s) => s.getAll());
  return all.filter((c) => c.docId === docId);
}

export async function getAllChunks(): Promise<Chunk[]> {
  return txAll<Chunk[]>(STORE_CHUNKS, 'readonly', (s) => s.getAll());
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await tx(STORE_CONVERSATIONS, 'readwrite', (s) => s.put(conv));
}

export async function getConversations(): Promise<Conversation[]> {
  const all = await txAll<Conversation[]>(STORE_CONVERSATIONS, 'readonly', (s) => s.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteConversation(id: string): Promise<void> {
  await tx(STORE_CONVERSATIONS, 'readwrite', (s) => s.delete(id));
}
