import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVFSStorage,
  VFS_STORAGE_SCHEMA_VERSION,
} from '../js/vfs-storage.js';

const KEY = 'test.vfs';
const BACKUP_KEY = `${KEY}.backup.pre-home-migration`;

function memoryLocalStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function treeWith(content = 'initial') {
  return {
    '/': { type:'dir', children:['file.txt'], id:'root-id', createdAt:1, modifiedAt:1 },
    '/file.txt': { type:'file', content, id:'file-id', createdAt:1, modifiedAt:1 },
  };
}

class MemoryDatabase {
  constructor(state = null) {
    this.state = state ? structuredClone(state) : null;
    this.blobs = new Map();
    this.writes = [];
    this.activeWrites = 0;
    this.maxActiveWrites = 0;
    this.failWrites = false;
  }
  async readState() { return this.state ? structuredClone(this.state) : undefined; }
  async readBlob(key) {
    const value = this.blobs.get(key);
    return value ? structuredClone(value) : undefined;
  }
  async writeSnapshot(key, state, blobs) {
    if (this.failWrites) throw new Error('IDB transaction aborted');
    this.activeWrites++;
    this.maxActiveWrites = Math.max(this.maxActiveWrites, this.activeWrites);
    const marker = state.tree?.['/file.txt']?.content || state.tree?.['/file.txt']?.__vfsBlobs?.src?.key || '';
    if (marker === 'first') await new Promise((resolve) => setTimeout(resolve, 20));
    this.state = structuredClone({ ...state, key });
    this.blobs = new Map(blobs.map((record) => [record.key, structuredClone(record)]));
    this.writes.push(marker);
    this.activeWrites--;
  }
  close() {}
}

function urlMock() {
  let next = 0;
  const created = [];
  const revoked = [];
  return {
    created,
    revoked,
    createObjectURL(blob) {
      const value = `blob:test-${++next}`;
      created.push({ value, blob });
      return value;
    },
    revokeObjectURL(value) { revoked.push(value); },
  };
}

test('first IndexedDB initialization preserves the HOME backup and migrates the current tree', async () => {
  const local = memoryLocalStorage();
  local.setItem(BACKUP_KEY, 'verbatim legacy disk');
  const db = new MemoryDatabase();
  const storage = createVFSStorage({
    key:KEY, localStorageImpl:local, openDatabase:async () => db,
  });

  const current = treeWith('after HOME migration');
  const result = await storage.initialize(current);
  await storage.flush();

  assert.equal(result.source, 'localStorage');
  assert.equal(db.state.schemaVersion, VFS_STORAGE_SCHEMA_VERSION);
  assert.equal(db.state.tree['/file.txt'].content, 'after HOME migration');
  assert.equal(local.getItem(BACKUP_KEY), 'verbatim legacy disk');
  assert.equal(storage.status().backend, 'indexeddb');
});

test('an existing IndexedDB tree wins and is never overwritten by stale local bootstrap data', async () => {
  const db = new MemoryDatabase({
    key:KEY,
    schemaVersion:VFS_STORAGE_SCHEMA_VERSION,
    updatedAt:10,
    tree:treeWith('newer IndexedDB data'),
  });
  const storage = createVFSStorage({ key:KEY, localStorageImpl:memoryLocalStorage(), openDatabase:async () => db });
  const result = await storage.initialize(treeWith('stale local data'));

  assert.equal(result.source, 'indexeddb');
  assert.equal(result.tree['/file.txt'].content, 'newer IndexedDB data');
  assert.deepEqual(db.writes, [], 'current IndexedDB state was rewritten during hydration');
});

test('schema 1 data URLs upgrade to Blob records and restore as object URLs', async () => {
  const pictureTree = treeWith('photo');
  pictureTree['/file.txt'] = {
    type:'file', kind:'image', id:'stable-photo-id', createdAt:1, modifiedAt:1,
    src:'data:text/plain;base64,aGVsbG8=',
  };
  pictureTree['/'].children.push('blob.bin');
  pictureTree['/blob.bin'] = {
    type:'file', kind:'data', id:'stable-blob-id', createdAt:1, modifiedAt:1,
    content:new Blob(['binary payload'], { type:'application/octet-stream' }),
  };
  const db = new MemoryDatabase({ key:KEY, schemaVersion:1, tree:pictureTree });
  const firstURLs = urlMock();
  const first = createVFSStorage({ key:KEY, localStorageImpl:memoryLocalStorage(), openDatabase:async () => db, URLImpl:firstURLs });
  await first.initialize(treeWith());
  await first.flush();

  assert.equal(db.state.schemaVersion, VFS_STORAGE_SCHEMA_VERSION);
  assert.equal(db.state.tree['/file.txt'].src, undefined);
  assert.equal(db.state.tree['/file.txt'].__vfsBlobs.src.key, 'stable-photo-id:src');
  assert.equal(db.blobs.get('stable-photo-id:src').blob.size, 5);
  assert.equal(db.state.tree['/blob.bin'].content, undefined);
  assert.equal(db.state.tree['/blob.bin'].__vfsBlobs.content.key, 'stable-blob-id:content');

  const restoredURLs = urlMock();
  const second = createVFSStorage({ key:KEY, localStorageImpl:memoryLocalStorage(), openDatabase:async () => db, URLImpl:restoredURLs });
  const restored = await second.initialize(treeWith('must not win'));
  assert.equal(restored.tree['/file.txt'].id, 'stable-photo-id');
  assert.equal(restored.tree['/file.txt'].src, 'blob:test-1');
  assert.equal(restoredURLs.created[0].blob.size, 5);
  assert.equal(restored.tree['/blob.bin'].content, 'blob:test-2');
});

test('writes are serialized and the newest snapshot remains durable', async () => {
  const db = new MemoryDatabase();
  const storage = createVFSStorage({ key:KEY, localStorageImpl:memoryLocalStorage(), openDatabase:async () => db });
  await storage.initialize(treeWith('bootstrap'));
  db.writes.length = 0;

  const first = treeWith('first');
  const second = treeWith('second');
  storage.save(first);
  storage.save(second);
  assert.equal(storage.status().pending, 2);
  assert.equal(await storage.flush(), true);

  assert.deepEqual(db.writes, ['first', 'second']);
  assert.equal(db.maxActiveWrites, 1);
  assert.equal(db.state.tree['/file.txt'].content, 'second');
  assert.equal(storage.status().pending, 0);
});

test('IndexedDB failure falls back to localStorage and exposes the fallback reason', async () => {
  const local = memoryLocalStorage();
  const events = [];
  const storage = createVFSStorage({
    key:KEY,
    localStorageImpl:local,
    openDatabase:async () => { throw new Error('IDB disabled'); },
    dispatch:(type, detail) => events.push({ type, detail }),
  });
  await storage.initialize(treeWith('fallback bootstrap'));
  storage.save(treeWith('fallback latest'));
  assert.equal(await storage.flush(), true);

  assert.equal(JSON.parse(local.getItem(KEY))['/file.txt'].content, 'fallback latest');
  assert.equal(storage.status().backend, 'localStorage');
  assert.equal(storage.status().fallbackReason.message, 'IDB disabled');
  assert.ok(events.some((event) => event.type === 'vfs-storage-status'));
});

test('a runtime IndexedDB write failure demotes once and preserves the snapshot in localStorage', async () => {
  const local = memoryLocalStorage();
  const db = new MemoryDatabase();
  const storage = createVFSStorage({ key:KEY, localStorageImpl:local, openDatabase:async () => db });
  await storage.initialize(treeWith('bootstrap'));
  db.failWrites = true;

  storage.save(treeWith('survived transaction abort'));
  assert.equal(await storage.flush(), true);

  const status = storage.status();
  assert.equal(status.backend, 'localStorage');
  assert.equal(status.fallbackReason.phase, 'write-indexeddb');
  assert.equal(JSON.parse(local.getItem(KEY))['/file.txt'].content, 'survived transaction abort');
});

test('quota failures leave the VFS in memory and are visible through status', async () => {
  const storage = createVFSStorage({
    key:KEY,
    localStorageImpl:{ setItem() { throw new DOMException('quota full', 'QuotaExceededError'); } },
    openDatabase:async () => { throw new Error('IDB disabled'); },
  });
  await storage.initialize(treeWith());
  storage.save(treeWith('unsaved but still in memory'));
  assert.equal(await storage.flush(), false);

  const status = storage.status();
  assert.equal(status.backend, 'memory');
  assert.equal(status.pending, 0);
  assert.equal(status.lastError.name, 'Error');
  assert.match(status.lastError.message, /durable storage backend|quota full/);
  assert.equal(status.schemaVersion, VFS_STORAGE_SCHEMA_VERSION);
});
