// Durable storage backend for the synchronous in-memory VFS.
//
// The public VFS remains synchronous.  This module hydrates it before boot and
// serializes every persistence write so rapid Finder operations cannot race.

export const VFS_STORAGE_SCHEMA_VERSION = 2;

const DB_NAME = 'macweb-vfs';
const STATE_STORE = 'state';
const BLOB_STORE = 'blobs';
const BLOB_FIELDS = ['src', 'data', 'blob', 'content'];

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  });
}

/** Open the production IndexedDB adapter. Tests inject a small in-memory one. */
export async function openVFSDatabase(indexedDBImpl = globalThis.indexedDB) {
  if (!indexedDBImpl?.open) throw new Error('IndexedDB is unavailable');
  const request = indexedDBImpl.open(DB_NAME, VFS_STORAGE_SCHEMA_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE, { keyPath: 'key' });
    if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE, { keyPath: 'key' });
  };
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another Leopard Web tab'));
  });
  db.onversionchange = () => db.close();

  return {
    async readState(key) {
      const transaction = db.transaction(STATE_STORE, 'readonly');
      return requestResult(transaction.objectStore(STATE_STORE).get(key));
    },
    async readBlob(key) {
      const transaction = db.transaction(BLOB_STORE, 'readonly');
      return requestResult(transaction.objectStore(BLOB_STORE).get(key));
    },
    async writeSnapshot(key, state, blobs) {
      const transaction = db.transaction([STATE_STORE, BLOB_STORE], 'readwrite');
      const stateStore = transaction.objectStore(STATE_STORE);
      const blobStore = transaction.objectStore(BLOB_STORE);
      blobStore.clear();
      blobs.forEach((record) => blobStore.put(record));
      stateStore.put({ ...state, key });
      await transactionDone(transaction);
    },
    close() { db.close(); },
  };
}

function clone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function jsonBytes(value) {
  const text = JSON.stringify(value);
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength;
  return text.length;
}

function isBlob(value, BlobImpl) {
  return !!BlobImpl && value instanceof BlobImpl;
}

function parseDataURL(value, BlobImpl) {
  if (typeof value !== 'string' || !value.startsWith('data:') || !BlobImpl) return null;
  const comma = value.indexOf(',');
  if (comma < 0) return null;
  const header = value.slice(5, comma);
  const mime = (header.split(';')[0] || 'application/octet-stream').trim();
  const encoded = value.slice(comma + 1);
  try {
    if (header.split(';').includes('base64')) {
      const binary = globalThis.atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
      return new BlobImpl([bytes], { type: mime });
    }
    return new BlobImpl([decodeURIComponent(encoded)], { type: mime });
  } catch (error) {
    return null;
  }
}

async function blobToDataURL(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Chunk the conversion to avoid overflowing the argument stack for photos.
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${globalThis.btoa(binary)}`;
}

function storageError(error, phase) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message || error || 'Unknown storage error'),
    phase,
    at: Date.now(),
  };
}

/**
 * Storage controller used by VFS.  The optional dependencies keep it directly
 * testable without shipping an IndexedDB polyfill in this zero-build project.
 */
export function createVFSStorage(options = {}) {
  const key = options.key || 'macweb.vfs.v1';
  const localStorageImpl = options.localStorageImpl ?? globalThis.localStorage;
  const indexedDBImpl = options.indexedDBImpl ?? globalThis.indexedDB;
  const BlobImpl = options.BlobImpl ?? globalThis.Blob;
  const URLImpl = options.URLImpl ?? globalThis.URL;
  const openDatabase = options.openDatabase
    || (() => openVFSDatabase(indexedDBImpl));
  const dispatch = options.dispatch || ((type, detail) => {
    try { globalThis.document?.dispatchEvent(new CustomEvent(type, { detail })); } catch (error) {}
  });

  let backend = 'initializing';
  let fallbackReason = null;
  let lastError = null;
  let lastSavedAt = null;
  let estimatedBytes = 0;
  let pending = 0;
  let db = null;
  let initialized = false;
  let lastWriteSucceeded = true;
  let writeQueue = Promise.resolve();
  let readyPromise = Promise.resolve(null);
  const blobCache = new Map();
  const objectURLs = new Map();

  function status() {
    return {
      backend,
      pending,
      lastError: lastError ? { ...lastError } : null,
      fallbackReason: fallbackReason ? { ...fallbackReason } : null,
      estimatedBytes,
      schemaVersion: VFS_STORAGE_SCHEMA_VERSION,
      lastSavedAt,
    };
  }

  function emitStatus() {
    dispatch('vfs-storage-status', status());
  }

  function report(error, phase, { fallback = false } = {}) {
    lastError = storageError(error, phase);
    if (fallback) fallbackReason = { ...lastError };
    lastWriteSucceeded = false;
    emitStatus();
  }

  async function valueAsBlob(value, ref, { allowDataURL = true } = {}) {
    if (isBlob(value, BlobImpl)) return value;
    const dataBlob = allowDataURL ? parseDataURL(value, BlobImpl) : null;
    if (dataBlob) return dataBlob;
    if (ref?.key && blobCache.has(ref.key)) return blobCache.get(ref.key);
    if (typeof value === 'string' && value.startsWith('blob:') && typeof fetch === 'function') {
      try { return await (await fetch(value)).blob(); } catch (error) { return null; }
    }
    return null;
  }

  async function prepareIndexedSnapshot(sourceTree) {
    const persistedTree = clone(sourceTree);
    const blobRecords = [];
    let blobBytes = 0;
    for (const node of Object.values(persistedTree)) {
      if (!node || typeof node !== 'object' || !node.id) continue;
      const refs = { ...(node.__vfsBlobs || {}) };
      for (const field of BLOB_FIELDS) {
        const value = node[field];
        const previousRef = refs[field];
        // Plain text whose first characters happen to be "data:" is still a
        // document body. Only actual Blob content is externalized in that
        // field; src/data/blob fields additionally accept data URLs.
        const blob = await valueAsBlob(value, previousRef, { allowDataURL:field !== 'content' });
        if (!blob) {
          delete refs[field];
          continue;
        }
        const blobKey = `${node.id}:${field}`;
        const ref = {
          key: blobKey,
          mime: blob.type || previousRef?.mime || 'application/octet-stream',
          size: Number.isFinite(blob.size) ? blob.size : previousRef?.size || 0,
        };
        refs[field] = ref;
        delete node[field];
        blobCache.set(blobKey, blob);
        blobRecords.push({ key: blobKey, nodeId: node.id, field, blob, mime: ref.mime, size: ref.size });
        blobBytes += ref.size;
      }
      if (Object.keys(refs).length) node.__vfsBlobs = refs;
      else delete node.__vfsBlobs;
    }
    return { persistedTree, blobRecords, bytes: jsonBytes(persistedTree) + blobBytes };
  }

  async function hydrateIndexedTree(sourceTree) {
    const hydrated = clone(sourceTree);
    for (const node of Object.values(hydrated)) {
      if (!node?.__vfsBlobs) continue;
      for (const [field, ref] of Object.entries(node.__vfsBlobs)) {
        const record = await db.readBlob(ref.key);
        const blob = record?.blob;
        if (!blob) throw new Error(`Missing VFS blob payload: ${ref.key}`);
        blobCache.set(ref.key, blob);
        if (URLImpl?.createObjectURL) {
          const url = URLImpl.createObjectURL(blob);
          objectURLs.set(ref.key, url);
          node[field] = url;
        } else {
          node[field] = await blobToDataURL(blob);
        }
      }
    }
    return hydrated;
  }

  async function persistIndexed(sourceTree) {
    const prepared = await prepareIndexedSnapshot(sourceTree);
    const state = {
      schemaVersion: VFS_STORAGE_SCHEMA_VERSION,
      updatedAt: Date.now(),
      tree: prepared.persistedTree,
    };
    await db.writeSnapshot(key, state, prepared.blobRecords);
    estimatedBytes = prepared.bytes;
    lastSavedAt = state.updatedAt;
    lastWriteSucceeded = true;
  }

  async function prepareLocalTree(sourceTree) {
    const localTree = clone(sourceTree);
    for (const node of Object.values(localTree)) {
      if (!node || typeof node !== 'object') continue;
      const refs = node.__vfsBlobs || {};
      for (const field of new Set([...BLOB_FIELDS, ...Object.keys(refs)])) {
        const blob = await valueAsBlob(node[field], refs[field], { allowDataURL:field !== 'content' });
        if (blob) node[field] = await blobToDataURL(blob);
      }
      delete node.__vfsBlobs;
    }
    return localTree;
  }

  async function persistLocal(sourceTree) {
    if (!localStorageImpl?.setItem) throw new Error('localStorage is unavailable');
    const localTree = await prepareLocalTree(sourceTree);
    const serialized = JSON.stringify(localTree);
    localStorageImpl.setItem(key, serialized);
    estimatedBytes = typeof TextEncoder === 'function'
      ? new TextEncoder().encode(serialized).byteLength
      : serialized.length;
    lastSavedAt = Date.now();
    lastWriteSucceeded = true;
  }

  function normalizeState(record) {
    if (!record || typeof record !== 'object') return null;
    if (record.tree && typeof record.tree === 'object') {
      return { schemaVersion: Number(record.schemaVersion) || 1, tree: record.tree };
    }
    // Schema 1 prototypes stored the tree directly as the record.
    if (record['/']) return { schemaVersion: 1, tree: record };
    return null;
  }

  async function initialize(initialTree, { allowInitialWrite = true } = {}) {
    if (initialized) return readyPromise;
    initialized = true;
    const initialSnapshot = clone(initialTree);
    readyPromise = (async () => {
      try {
        db = await openDatabase();
        const state = normalizeState(await db.readState(key));
        backend = 'indexeddb';
        emitStatus();
        if (state) {
          if (state.schemaVersion > VFS_STORAGE_SCHEMA_VERSION) {
            throw new Error(`VFS schema ${state.schemaVersion} is newer than supported schema ${VFS_STORAGE_SCHEMA_VERSION}`);
          }
          const hydrated = await hydrateIndexedTree(state.tree);
          estimatedBytes = jsonBytes(state.tree)
            + Object.values(state.tree).reduce((sum, node) => sum
              + Object.values(node?.__vfsBlobs || {}).reduce((n, ref) => n + (ref?.size || 0), 0), 0);
          if (state.schemaVersion < VFS_STORAGE_SCHEMA_VERSION && allowInitialWrite) {
            await persistIndexed(hydrated);
          }
          lastWriteSucceeded = true;
          emitStatus();
          return { tree: hydrated, source: 'indexeddb', schemaVersion: state.schemaVersion };
        }
        if (allowInitialWrite) await persistIndexed(initialSnapshot);
        emitStatus();
        return { tree: initialSnapshot, source: 'localStorage', schemaVersion: VFS_STORAGE_SCHEMA_VERSION };
      } catch (error) {
        try { db?.close?.(); } catch (closeError) {}
        db = null;
        backend = 'localStorage';
        report(error, 'open-or-hydrate-indexeddb', { fallback: true });
        if (allowInitialWrite) {
          try { await persistLocal(initialSnapshot); }
          catch (localError) {
            backend = 'memory';
            report(localError, 'initialize-localstorage');
          }
        }
        emitStatus();
        return { tree: initialSnapshot, source: 'localStorage', schemaVersion: VFS_STORAGE_SCHEMA_VERSION };
      }
    })();
    return readyPromise;
  }

  function save(sourceTree) {
    const queuedTree = clone(sourceTree);
    pending++;
    emitStatus();
    const task = writeQueue
      .catch(() => {})
      .then(async () => {
        await readyPromise;
        if (backend === 'indexeddb' && db) {
          try {
            await persistIndexed(queuedTree);
          } catch (indexedDBError) {
            // A database may become unavailable after a successful boot (for
            // example private-mode eviction or a transaction abort). Demote it
            // once and preserve the same queued snapshot in localStorage.
            try { db.close?.(); } catch (closeError) {}
            db = null;
            backend = 'localStorage';
            report(indexedDBError, 'write-indexeddb', { fallback:true });
            try {
              await persistLocal(queuedTree);
            } catch (localError) {
              backend = 'memory';
              report(localError, 'write-localstorage-after-indexeddb');
              return false;
            }
          }
        } else if (backend === 'localStorage') {
          try {
            await persistLocal(queuedTree);
          } catch (localError) {
            backend = 'memory';
            report(localError, 'write-localstorage');
            return false;
          }
        } else {
          throw new Error('VFS has no durable storage backend');
        }
        emitStatus();
        return true;
      })
      .catch((error) => {
        report(error, backend === 'indexeddb' ? 'write-indexeddb' : 'write-localstorage');
        return false;
      })
      .finally(() => {
        pending = Math.max(0, pending - 1);
        emitStatus();
      });
    writeQueue = task;
    return task;
  }

  async function flush() {
    await readyPromise;
    await writeQueue;
    return lastWriteSucceeded;
  }

  function revokeObjectURLs() {
    objectURLs.forEach((url) => {
      try { URLImpl?.revokeObjectURL?.(url); } catch (error) {}
    });
    objectURLs.clear();
  }

  function close() {
    revokeObjectURLs();
    try { db?.close?.(); } catch (error) {}
  }

  // Do not close the IndexedDB connection in front of a queued Finder write.
  // The page may disappear before the promise settles, but allowing the
  // transaction to start is safer than deterministically invalidating it.
  const closeAfterWrites = () => {
    revokeObjectURLs();
    writeQueue.catch(() => {}).finally(() => {
      try { db?.close?.(); } catch (error) {}
    });
  };
  try { globalThis.addEventListener?.('pagehide', closeAfterWrites, { once: true }); } catch (error) {}

  return {
    initialize,
    save,
    flush,
    status,
    reportError: (error, phase) => report(error, phase),
    close,
  };
}
