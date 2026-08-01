import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = readFileSync(new URL('../js/vfs.js', import.meta.url), 'utf8');

function boot(seed) {
  const values = new Map();
  if (seed) values.set('macweb.vfs.v1', JSON.stringify(seed));
  const events = [];
  const context = vm.createContext({
    Blob,
    console,
    crypto:webcrypto,
    CustomEvent:class CustomEvent {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
    document:{ dispatchEvent:event => { events.push(event); return true; } },
    localStorage:{
      getItem:key => values.has(key) ? values.get(key) : null,
      setItem:(key, value) => values.set(key, String(value)),
    },
  });
  vm.runInContext(`${source}\nglobalThis.__testVfs = VFS;`, context, { filename:'vfs.js' });
  return { VFS:context.__testVfs, events, values };
}

function assertTree(VFS) {
  const tree = VFS.exportTree();
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
    const parent = VFS.parentOf(path);
    assert.ok(tree[parent]?.children.includes(VFS.baseName(path)), `${path} is orphaned`);
  }
}

const legacy = {
  '/':{ type:'dir', children:['用户','系统'] },
  '/用户':{ type:'dir', children:['roll'] },
  '/用户/roll':{ type:'dir', children:['桌面','文稿'] },
  '/用户/roll/桌面':{ type:'dir', children:['旧文件.txt'] },
  '/用户/roll/桌面/旧文件.txt':{ type:'file', content:'legacy' },
  '/用户/roll/文稿':{ type:'dir', children:[] },
  '/系统':{ type:'dir', children:[] },
};
const migrated = boot(legacy).VFS;
assert.equal(migrated.get('/用户/roll/桌面/旧文件.txt').content, 'legacy');
assertTree(migrated);

const staleAppTree = {
  '/':{ type:'dir', children:['用户','系统','应用程序','旧应用归档'] },
  '/用户':{ type:'dir', children:['roll'] },
  '/用户/roll':{ type:'dir', children:['文稿'] },
  '/用户/roll/文稿':{ type:'dir', children:['项目资料'] },
  '/用户/roll/文稿/项目资料':{ type:'dir', children:['旧工具.app','计算器.app','说明.txt'] },
  '/用户/roll/文稿/项目资料/旧工具.app':{ type:'app', appId:'retired-example' },
  '/用户/roll/文稿/项目资料/计算器.app':{ type:'app', appId:'calculator', alias:true },
  '/用户/roll/文稿/项目资料/说明.txt':{ type:'file', content:'keep me' },
  '/系统':{ type:'dir', children:[] },
  '/应用程序':{ type:'dir', children:['旧工具.app'] },
  '/应用程序/旧工具.app':{ type:'app', appId:'retired-example' },
  '/旧应用归档':{ type:'dir', children:['旧工具.app'] },
  '/旧应用归档/旧工具.app':{ type:'app', appId:'retired-example' },
};
const reconciled = boot(staleAppTree).VFS;
assert.equal(reconciled.get('/应用程序/旧工具.app'), null, 'obsolete managed app survived');
assert.equal(reconciled.get('/用户/roll/文稿/项目资料/旧工具.app'), null, 'obsolete app alias survived');
assert.equal(reconciled.get('/旧应用归档'), null, 'root folder emptied by reconciliation survived');
assert.equal(reconciled.get('/用户/roll/文稿/项目资料/计算器.app').appId, 'calculator');
assert.equal(reconciled.get('/用户/roll/文稿/项目资料/说明.txt').content, 'keep me');
assertTree(reconciled);

const { VFS, events } = boot();
assertTree(VFS);

assert.equal(VFS.mkdir('/用户/roll/文稿/事务测试'), true);
assert.equal(VFS.writeFile('/用户/roll/文稿/事务测试/你好.txt', '你好 Leopard'), true);
assert.equal(VFS.sizeOf('/用户/roll/文稿/事务测试/你好.txt'), new Blob(['你好 Leopard']).size);
assert.equal(VFS.putNode('/用户/roll/文稿/事务测试/富文本.txt', {
  type:'file', content:'加粗', richText:'<b>加粗</b>', mime:'text/plain',
}), true);
assert.equal(VFS.get('/用户/roll/文稿/事务测试/富文本.txt').richText, '<b>加粗</b>');
assert.equal(VFS.canUndo(), true);
assert.ok(VFS.undo());
assert.equal(VFS.get('/用户/roll/文稿/事务测试/富文本.txt'), null);
assert.ok(VFS.redo());
assert.equal(VFS.get('/用户/roll/文稿/事务测试/富文本.txt').content, '加粗');

VFS.transaction('批量创建', () => {
  VFS.writeFile('/用户/roll/文稿/事务测试/A.txt', 'A');
  VFS.writeFile('/用户/roll/文稿/事务测试/B.txt', 'B');
});
assert.equal(VFS.get('/用户/roll/文稿/事务测试/A.txt').content, 'A');
assert.equal(VFS.get('/用户/roll/文稿/事务测试/B.txt').content, 'B');
assert.equal(VFS.undoLabel(), '批量创建');
VFS.undo();
assert.equal(VFS.get('/用户/roll/文稿/事务测试/A.txt'), null);
assert.equal(VFS.get('/用户/roll/文稿/事务测试/B.txt'), null);
VFS.redo();

const original = '/用户/roll/文稿/事务测试/你好.txt';
const trashed = VFS.move(original, '/用户/roll/.废纸篓', {
  sourcePatch:{ from:original },
  label:'移到废纸篓',
});
assert.ok(trashed);
assert.equal(VFS.get(trashed).from, original);
VFS.undo();
assert.equal(VFS.get(original).from, undefined);
VFS.redo();
assert.equal(VFS.get(trashed).from, original);
VFS.undo();

assert.equal(VFS.mkdir('/用户/roll/文稿/事务测试/来源'), true);
assert.equal(VFS.mkdir('/用户/roll/文稿/事务测试/目的'), true);
VFS.writeFile('/用户/roll/文稿/事务测试/来源/同名.txt', 'new');
VFS.writeFile('/用户/roll/文稿/事务测试/目的/同名.txt', 'old');
assert.equal(VFS.move('/用户/roll/文稿/事务测试/来源/同名.txt', '/用户/roll/文稿/事务测试/目的', {
  conflict:'error', sourcePatch:{ from:'/should-not-stick' },
}), false);
assert.equal(VFS.get('/用户/roll/文稿/事务测试/来源/同名.txt').from, undefined);
const replaced = VFS.copy('/用户/roll/文稿/事务测试/来源/同名.txt', '/用户/roll/文稿/事务测试/目的', { conflict:'replace' });
assert.equal(VFS.get(replaced).content, 'new');
VFS.undo();
assert.equal(VFS.get('/用户/roll/文稿/事务测试/目的/同名.txt').content, 'old');

assert.throws(() => VFS.transaction('应回滚', () => {
  VFS.writeFile('/用户/roll/文稿/事务测试/回滚.txt', 'temporary');
  throw new Error('rollback');
}));
assert.equal(VFS.get('/用户/roll/文稿/事务测试/回滚.txt'), null);

const renamed = VFS.rename('/用户/roll/文稿/事务测试/来源', '已改名');
assert.ok(renamed);
assert.equal(VFS.get('/用户/roll/文稿/事务测试/已改名/同名.txt').content, 'new');
assert.equal(VFS.get('/用户/roll/文稿/事务测试/来源'), null);
const lastUndoLabel = VFS.undoLabel();
assert.equal(VFS.remove('/用户/roll/文稿/事务测试/目的/同名.txt', { record:false }), true);
assert.equal(VFS.undoLabel(), lastUndoLabel, 'a permanent removal entered the undo history');
assertTree(VFS);
assert.ok(events.some((event) => event.type === 'vfs-changed'));
assert.ok(events.some((event) => event.type === 'vfs-history-changed'));

console.log('VFS smoke tests passed');
