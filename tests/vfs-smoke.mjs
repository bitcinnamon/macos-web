import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

// Minimal browser globals for VFS module side effects.
const values = new Map();
const events = [];
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  },
  configurable: true,
});
Object.defineProperty(globalThis, 'document', {
  value: {
    dispatchEvent: (event) => {
      events.push(event);
      return true;
    },
  },
  configurable: true,
});
Object.defineProperty(globalThis, 'CustomEvent', {
  value: class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  },
  configurable: true,
});
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
if (!globalThis.Blob) {
  globalThis.Blob = class Blob {
    constructor(parts = []) {
      this.size = parts.reduce((n, part) => n + String(part).length, 0);
    }
  };
}

const { paths, HOME_USER } = await import('../js/config.js');
// Fresh module load with empty storage
const { VFS } = await import('../js/vfs.js');

function assertTree(vfs) {
  const tree = vfs.exportTree();
  for (const [path, node] of Object.entries(tree)) {
    assert.equal(typeof node.id, 'string', `${path} is missing an id`);
    assert.equal(Number.isFinite(node.createdAt), true, `${path} is missing createdAt`);
    assert.equal(Number.isFinite(node.modifiedAt), true, `${path} is missing modifiedAt`);
    if (node.type !== 'dir') continue;
    assert.equal(new Set(node.children).size, node.children.length, `${path} has duplicate children`);
    for (const name of node.children) {
      const child = path === '/' ? `/${name}` : `${path}/${name}`;
      assert.ok(tree[child], `${path} points to missing ${child}`);
    }
  }
  for (const path of Object.keys(tree)) {
    if (path === '/') continue;
    const parent = vfs.parentOf(path);
    assert.ok(tree[parent]?.children.includes(vfs.baseName(path)), `${path} is orphaned`);
  }
}

assert.equal(VFS.list('/用户')?.includes(HOME_USER), true);
assert.ok(VFS.isDir(paths.home));
assert.ok(VFS.isDir(paths.desktop));
assertTree(VFS);

assert.equal(VFS.mkdir(`${paths.documents}/事务测试`), true);
assert.equal(VFS.writeFile(`${paths.documents}/事务测试/你好.txt`, '你好 Leopard'), true);
assert.equal(VFS.sizeOf(`${paths.documents}/事务测试/你好.txt`), new Blob(['你好 Leopard']).size);
assert.equal(VFS.putNode(`${paths.documents}/事务测试/富文本.txt`, {
  type: 'file',
  content: '加粗',
  richText: '<b>加粗</b>',
}), true);
assert.equal(VFS.get(`${paths.documents}/事务测试/富文本.txt`).richText, '<b>加粗</b>');
assert.ok(VFS.undo());
assert.equal(VFS.get(`${paths.documents}/事务测试/富文本.txt`), null);
assert.ok(VFS.redo());
assert.equal(VFS.get(`${paths.documents}/事务测试/富文本.txt`).content, '加粗');

VFS.transaction('批量创建', () => {
  VFS.writeFile(`${paths.documents}/事务测试/A.txt`, 'A');
  VFS.writeFile(`${paths.documents}/事务测试/B.txt`, 'B');
});
assert.equal(VFS.get(`${paths.documents}/事务测试/A.txt`).content, 'A');
assert.equal(VFS.get(`${paths.documents}/事务测试/B.txt`).content, 'B');
assert.equal(VFS.undoLabel(), '批量创建');
assert.ok(VFS.undo());
assert.equal(VFS.get(`${paths.documents}/事务测试/A.txt`), null);
assert.equal(VFS.get(`${paths.documents}/事务测试/B.txt`), null);

const original = `${paths.documents}/事务测试/你好.txt`;
const trashed = VFS.move(original, paths.trash, {
  sourcePatch: { from: original },
  label: '移到废纸篓',
});
assert.ok(trashed);
assert.equal(VFS.get(trashed).from, original);
assert.ok(VFS.undo());
assert.equal(VFS.get(original).from, undefined);
assert.ok(VFS.redo());
assert.equal(VFS.get(trashed).from, original);
assert.ok(VFS.undo());

assert.equal(VFS.mkdir(`${paths.documents}/事务测试/来源`), true);
assert.equal(VFS.mkdir(`${paths.documents}/事务测试/目的`), true);
VFS.writeFile(`${paths.documents}/事务测试/来源/同名.txt`, 'new');
VFS.writeFile(`${paths.documents}/事务测试/目的/同名.txt`, 'old');
assert.equal(VFS.move(`${paths.documents}/事务测试/来源/同名.txt`, `${paths.documents}/事务测试/目的`, {
  conflict: 'error',
  sourcePatch: { from: '/should-not-stick' },
}), false);
assert.equal(VFS.get(`${paths.documents}/事务测试/来源/同名.txt`).from, undefined);
const replaced = VFS.copy(`${paths.documents}/事务测试/来源/同名.txt`, `${paths.documents}/事务测试/目的`, { conflict: 'replace' });
assert.equal(VFS.get(replaced).content, 'new');
assert.ok(VFS.undo());
assert.equal(VFS.get(`${paths.documents}/事务测试/目的/同名.txt`).content, 'old');

assert.throws(() => VFS.transaction('应回滚', () => {
  VFS.writeFile(`${paths.documents}/事务测试/回滚.txt`, 'temporary');
  throw new Error('rollback');
}));
assert.equal(VFS.get(`${paths.documents}/事务测试/回滚.txt`), null);

const renamed = VFS.rename(`${paths.documents}/事务测试/来源`, '已改名');
assert.ok(renamed);
assert.equal(VFS.get(`${paths.documents}/事务测试/已改名/同名.txt`).content, 'new');
assert.equal(VFS.get(`${paths.documents}/事务测试/来源`), null);
const lastUndoLabel = VFS.undoLabel();
assert.equal(VFS.remove(`${paths.documents}/事务测试/目的/同名.txt`, { record: false }), true);
assert.equal(VFS.undoLabel(), lastUndoLabel, 'a permanent removal entered the undo history');
assertTree(VFS);

// Old builds used localized app names as physical paths and could append a
// second node for the same managed appId after reloading in another language.
// Import reconciliation must retain one stable managed node without touching
// ordinary user files that happen to have similar names.
const duplicateApps = VFS.exportTree();
const calculatorPath = Object.keys(duplicateApps).find((path) =>
  VFS.parentOf(path) === '/应用程序' && duplicateApps[path]?.type === 'app'
    && duplicateApps[path]?.appId === 'calculator');
assert.ok(calculatorPath, 'calculator managed app fixture is missing');
const duplicateCalculatorPath = '/应用程序/Calculator Legacy Duplicate.app';
duplicateApps[duplicateCalculatorPath] = {
  ...duplicateApps[calculatorPath], id:'legacy-calculator-duplicate', createdAt:1, modifiedAt:1,
};
duplicateApps['/应用程序'].children.push(VFS.baseName(duplicateCalculatorPath));
duplicateApps['/应用程序/Calculator Legacy Duplicate.txt'] = {
  type:'file', content:'ordinary user data', id:'ordinary-same-name', createdAt:1, modifiedAt:1,
};
duplicateApps['/应用程序'].children.push('Calculator Legacy Duplicate.txt');
assert.equal(VFS.importTree(duplicateApps), true);
const reconciledApps = VFS.exportTree();
const calculatorNodes = Object.entries(reconciledApps).filter(([path, node]) =>
  VFS.parentOf(path) === '/应用程序' && node?.type === 'app' && node.appId === 'calculator');
assert.equal(calculatorNodes.length, 1, 'localized managed app duplicates were not reconciled by appId');
assert.equal(reconciledApps['/应用程序/Calculator Legacy Duplicate.txt'].content, 'ordinary user data');
assertTree(VFS);
assert.ok(events.some((event) => event.type === 'vfs-changed'));
assert.ok(events.some((event) => event.type === 'vfs-history-changed'));

console.log('VFS smoke tests passed');
