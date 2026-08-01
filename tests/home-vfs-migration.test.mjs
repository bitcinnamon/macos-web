import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

function installBrowserGlobals() {
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key) => (values.has(key) ? values.get(key) : null),
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
      clear: () => values.clear(),
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: { dispatchEvent: () => true }, configurable: true,
  });
  Object.defineProperty(globalThis, 'CustomEvent', {
    value: class CustomEvent {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
    configurable: true,
  });
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  if (!globalThis.Blob) {
    Object.defineProperty(globalThis, 'Blob', {
      value: class Blob {
        constructor(parts = []) { this.size = parts.reduce((total, part) => total + String(part).length, 0); }
      },
      configurable: true,
    });
  }
  return values;
}

const values = installBrowserGlobals();
const {
  VFS_KEY, VFS_LEGACY_HOME, VFS_HOME_MIGRATION_BACKUP_KEY,
  HOME_USER, paths,
} = await import('../js/config.js');

const dir = (children, extra = {}) => ({ type:'dir', children, ...extra });

function legacyTree() {
  const legacyDesktop = `${VFS_LEGACY_HOME}/桌面`;
  const legacyDocuments = `${VFS_LEGACY_HOME}/文稿`;
  const legacyTrash = `${VFS_LEGACY_HOME}/.废纸篓`;
  return {
    '/': dir(['应用程序', '系统', '用户'], { id:'root-id', createdAt:1, modifiedAt:2 }),
    '/应用程序': dir(['Retired Utility.app', 'Personal Notes.txt']),
    '/应用程序/Retired Utility.app': { type:'app', appId:'retired-app', id:'old-app-id', createdAt:3, modifiedAt:4 },
    '/应用程序/Personal Notes.txt': { type:'file', content:'not a managed app', id:'personal-id', createdAt:5, modifiedAt:6 },
    '/系统': dir([]),
    '/用户': dir(['roll']),
    [VFS_LEGACY_HOME]: dir(['桌面', '文稿', '.废纸篓'], { id:'home-id', createdAt:10, modifiedAt:11 }),
    [legacyDesktop]: dir(['照片.txt'], { id:'desktop-id', createdAt:12, modifiedAt:13 }),
    [`${legacyDesktop}/照片.txt`]: {
      type:'file', id:'file-id', createdAt:14, modifiedAt:15,
      content:`literal file body keeps ${VFS_LEGACY_HOME}/文稿 unchanged`,
      from:`${legacyDocuments}/原件.txt`,
      target:`${legacyDesktop}/照片.txt`,
      metadata:{ directory:legacyDocuments, paths:[legacyDesktop, `${legacyDocuments}/原件.txt`] },
    },
    [legacyDocuments]: dir(['原件.txt']),
    [`${legacyDocuments}/原件.txt`]: { type:'file', content:'preserve me', id:'original-id', createdAt:16, modifiedAt:17 },
    [legacyTrash]: dir([]),
  };
}

test('legacy HOME is backed up and migrated without losing user data or metadata', async () => {
  values.clear();
  const legacy = legacyTree();
  const raw = JSON.stringify(legacy);
  localStorage.setItem(VFS_KEY, raw);

  const { VFS } = await import('../js/vfs.js?home-migration');
  const migrated = VFS.exportTree();
  const migratedFile = migrated[`${paths.desktop}/照片.txt`];

  assert.equal(localStorage.getItem(VFS_HOME_MIGRATION_BACKUP_KEY), raw, 'pre-migration disk was not backed up verbatim');
  assert.equal(migrated[VFS_LEGACY_HOME], undefined);
  assert.equal(migrated[`${VFS_LEGACY_HOME}/桌面`], undefined);
  assert.equal(migrated[paths.home].id, 'home-id');
  assert.equal(migratedFile.id, 'file-id');
  assert.equal(migratedFile.createdAt, 14);
  assert.equal(migratedFile.modifiedAt, 15);
  assert.equal(migratedFile.content, `literal file body keeps ${VFS_LEGACY_HOME}/文稿 unchanged`);
  assert.equal(migratedFile.from, `${paths.documents}/原件.txt`);
  assert.equal(migratedFile.target, `${paths.desktop}/照片.txt`);
  assert.equal(migratedFile.metadata.directory, paths.documents);
  assert.deepEqual(migratedFile.metadata.paths, [paths.desktop, `${paths.documents}/原件.txt`]);
  assert.equal(migrated[`${paths.documents}/原件.txt`].content, 'preserve me');
  assert.deepEqual(migrated['/用户'].children, [HOME_USER]);

  assert.equal(migrated['/应用程序/Retired Utility.app'], undefined, 'stale managed app was not reconciled');
  assert.equal(migrated['/应用程序/Personal Notes.txt'].content, 'not a managed app', 'ordinary user file was removed');

  const persisted = JSON.parse(localStorage.getItem(VFS_KEY));
  assert.equal(persisted[`${paths.documents}/原件.txt`].id, 'original-id');

  const backupBeforeReload = localStorage.getItem(VFS_HOME_MIGRATION_BACKUP_KEY);
  const { VFS: ReloadedVFS } = await import('../js/vfs.js?home-migration-reload');
  assert.equal(ReloadedVFS.get(`${paths.documents}/原件.txt`).content, 'preserve me');
  assert.equal(localStorage.getItem(VFS_HOME_MIGRATION_BACKUP_KEY), backupBeforeReload, 'idempotent reload replaced the safety backup');
});

test('a valid configured HOME is never overwritten by legacy data', async () => {
  values.clear();
  const legacy = legacyTree();
  legacy['/用户'].children.push(HOME_USER);
  legacy[paths.home] = dir(['文稿'], { id:'new-home-id', createdAt:101, modifiedAt:102 });
  legacy[paths.documents] = dir(['current.txt']);
  legacy[`${paths.documents}/current.txt`] = {
    type:'file', content:'new-home-wins', id:'current-id', createdAt:103, modifiedAt:104,
  };
  localStorage.setItem(VFS_KEY, JSON.stringify(legacy));

  const { VFS } = await import('../js/vfs.js?new-home-wins');
  assert.equal(VFS.get(`${paths.documents}/current.txt`).content, 'new-home-wins');
  assert.equal(VFS.get(paths.home).id, 'new-home-id');
  assert.ok(VFS.get(VFS_LEGACY_HOME), 'legacy branch should not be destructively merged into a valid configured HOME');
  assert.equal(localStorage.getItem(VFS_HOME_MIGRATION_BACKUP_KEY), null);
});

test('localized managed app duplicates reconcile by appId without touching user files', async () => {
  values.clear();
  const saved = {
    '/': dir(['应用程序', '系统', '用户']),
    '/应用程序': dir(['计算器.app', 'Calculator.app', 'Personal Notes.txt']),
    '/应用程序/计算器.app': {
      type:'app', appId:'calculator', id:'original-calculator-id', createdAt:21, modifiedAt:22,
    },
    '/应用程序/Calculator.app': {
      type:'app', appId:'calculator', id:'duplicate-calculator-id', createdAt:23, modifiedAt:24,
    },
    '/应用程序/Personal Notes.txt': {
      type:'file', content:'keep this ordinary file', id:'personal-notes-id', createdAt:25, modifiedAt:26,
    },
    '/系统': dir([]),
    '/用户': dir([HOME_USER]),
    [paths.home]: dir(['文稿']),
    [paths.documents]: dir([]),
  };
  localStorage.setItem(VFS_KEY, JSON.stringify(saved));

  const { VFS } = await import('../js/vfs.js?localized-app-reconcile');
  await VFS.ready;
  const tree = VFS.exportTree();
  const calculators = Object.entries(tree)
    .filter(([path, node]) => VFS.parentOf(path) === '/应用程序'
      && node?.type === 'app' && node.appId === 'calculator');

  assert.equal(calculators.length, 1, 'localized app nodes were only hidden instead of reconciled');
  assert.equal(calculators[0][0], '/应用程序/计算器.app');
  assert.equal(calculators[0][1].id, 'original-calculator-id', 'the original managed node lost its identity');
  assert.equal(tree['/应用程序/Calculator.app'], undefined);
  assert.equal(tree['/应用程序/Personal Notes.txt'].content, 'keep this ordinary file');
});
