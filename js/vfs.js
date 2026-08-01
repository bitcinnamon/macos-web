// Synchronous in-memory virtual file system with an asynchronous durable store.
// Shared by Finder, Terminal, TextEdit and the document panels.
import {
  VFS_KEY, VFS_LEGACY_HOME, VFS_HOME_MIGRATION_BACKUP_KEY,
  HOME_USER, HOME_DISPLAY_NAME, paths, systemPaths,
} from './config.js';
import { t, getLocale } from './i18n/index.js';
import { createVFSStorage } from './vfs-storage.js';

export const VFS = (() => {
  const KEY = VFS_KEY;
  const HISTORY_LIMIT = 50;
  let undoStack = [];
  let redoStack = [];
  let historySuppressed = 0;
  let mutationVersion = 0;

  const now = () => Date.now();
  const makeId = () => {
    try { return crypto.randomUUID(); }
    catch (e) { return `vfs-${now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
  };
  const byteSize = (value) => {
    if (value == null) return 0;
    try { return new Blob([String(value)]).size; }
    catch (e) { return String(value).length; }
  };
  function enrichNode(node, timestamp, fresh = false) {
    if (!node || typeof node !== 'object') return node;
    const time = timestamp || now();
    if (!node.id || fresh) node.id = makeId();
    if (!Number.isFinite(node.createdAt) || fresh) node.createdAt = time;
    if (!Number.isFinite(node.modifiedAt) || fresh) node.modifiedAt = time;
    return node;
  }
  function ensureMetadata(t) {
    const time = now();
    Object.values(t).forEach((node) => enrichNode(node, time));
  }

  /** Demo files and copy shown on first boot — follow UI locale. */
  function demoSeed() {
    const en = getLocale() === 'en';
    return en ? {
      welcomeName: 'Welcome.txt',
      welcomeBody: 'Welcome to Mac OS X Leopard Web!\n\nDouble-click .txt files to open them in TextEdit.\nTry the apps in the Dock.',
      listName: 'Shopping List.txt',
      listBody: 'Milk\nEggs\nBread\nCoffee beans',
      journalName: 'Journal.txt',
      journalBody: 'Installed a Mac in the browser today.\nLooks good.',
      pic1: 'Aurora.svg',
      pic2: 'Tiger Waves.svg',
      safariName: 'Welcome to Safari.txt',
      safariBody: 'Items downloaded in Safari appear here and in the Dock Downloads stack.',
      siteHtml: '<!doctype html><title>roll’s Site</title><h1>Welcome</h1>',
      readme: 'This is a pure front-end Mac OS X.\nFiles are stored locally in this browser (IndexedDB when available).',
      versionName: 'Version.txt',
      userFileSuffix: ' (user file)',
      userFileSuffixN: (i) => ` (user file ${i})`,
    } : {
      welcomeName: '欢迎.txt',
      welcomeBody: '欢迎来到 Mac OS X Leopard 网页版！\n\n双击 .txt 文件会用「文本编辑」打开。\n试试 Dock 里的各个应用吧。',
      listName: '购物清单.txt',
      listBody: '牛奶\n鸡蛋\n面包\n咖啡豆',
      journalName: '日记.txt',
      journalBody: '今天在浏览器里装了一台 Mac。\n感觉不错。',
      pic1: '极光.svg',
      pic2: '虎纹波浪.svg',
      safariName: '欢迎使用 Safari.txt',
      safariBody: '从 Safari 下载的项目会出现在这里，也会显示在 Dock 的“下载”堆栈中。',
      siteHtml: '<!doctype html><title>roll 的网站</title><h1>欢迎</h1>',
      readme: '这是一个纯前端实现的 Mac OS X。\n文件保存在此浏览器的本地存储中（可用时使用 IndexedDB）。',
      versionName: '版本.txt',
      userFileSuffix: '（用户文件）',
      userFileSuffixN: (i) => `（用户文件 ${i}）`,
    };
  }

  function defaults() {
    const d = demoSeed();
    return {
      '/': { type: 'dir', children: ['应用程序', '资料库', '系统', '用户'] },
      '/资料库': { type: 'dir', children: ['Application Support', 'Fonts', 'Preferences'] },
      '/资料库/Application Support': { type: 'dir', children: [] },
      '/资料库/Fonts': { type: 'dir', children: [] },
      '/资料库/Preferences': { type: 'dir', children: [] },
      [paths.users]: { type: 'dir', children: [HOME_USER] },
      [paths.home]: { type: 'dir', children: ['桌面', '文稿', '下载', '影片', '图片', '音乐', '公共', '站点', 'README.txt', '.废纸篓'] },
      [paths.trash]: { type: 'dir', children: [] },
      [paths.desktop]: { type: 'dir', children: [d.welcomeName] },
      [`${paths.desktop}/${d.welcomeName}`]: { type: 'file', content: d.welcomeBody },
      [paths.documents]: { type: 'dir', children: [d.listName, d.journalName] },
      [`${paths.documents}/${d.listName}`]: { type: 'file', content: d.listBody },
      [`${paths.documents}/${d.journalName}`]: { type: 'file', content: d.journalBody },
      [paths.pictures]: { type: 'dir', children: [d.pic1, d.pic2] },
      [`${paths.pictures}/${d.pic1}`]: { type: 'file', kind: 'image', src: 'assets/aurora.svg' },
      [`${paths.pictures}/${d.pic2}`]: { type: 'file', kind: 'image', src: 'assets/tiger.svg' },
      [paths.music]: { type: 'dir', children: [] },
      [paths.downloads]: { type: 'dir', children: [d.safariName] },
      [`${paths.downloads}/${d.safariName}`]: { type: 'file', content: d.safariBody },
      [paths.movies]: { type: 'dir', children: [] },
      [paths.public]: { type: 'dir', children: [] },
      [paths.sites]: { type: 'dir', children: ['index.html'] },
      [`${paths.sites}/index.html`]: { type: 'file', content: d.siteHtml },
      [`${paths.home}/README.txt`]: { type: 'file', content: d.readme },
      '/应用程序': { type: 'dir', children: [] },
      '/系统': { type: 'dir', children: [d.versionName] },
      [`/系统/${d.versionName}`]: { type: 'file', content: 'Mac OS X 10.5 Leopard (Web Edition)\nBuild 9A581-www' },
    };
  }

  // Apps/kexts injected on every load so old saved trees pick up new system files.
  function ensureSystem(tree) {
    // App labels follow the current UI language (en/zh-CN).
    const apps = [
      [t('app.mail'), 'mail'], [t('app.addressbook'), 'addressbook'], [t('app.ichat'), 'ichat'], [t('app.safari'), 'safari'],
      [t('app.ical'), 'ical'], [t('app.itunes'), 'itunes'], [t('app.photobooth'), 'photobooth'], [t('app.quicktime'), 'quicktime'],
      [t('app.dvdplayer'), 'dvdplayer'], [t('app.frontrow'), 'frontrow'], [t('app.dictionary'), 'dictionary'],
      [t('app.automator'), 'automator'], [t('app.imagecapture'), 'imagecapture'], [t('app.dashboard'), 'dashboard'],
      [t('app.timemachine'), 'timemachine'], [t('app.notes'), 'notes'], [t('app.stickies'), 'stickies'], [t('app.textedit'), 'textedit'],
      [t('app.calculator'), 'calculator'], [t('app.terminal'), 'terminal'], [t('app.preview'), 'preview'], [t('app.chess'), 'chess'],
      [t('app.sysprefs'), 'sysprefs'],
    ];
    const utils = [
      [t('app.diskutil'), 'diskutil'], [t('app.activity'), 'activity'], [t('app.consoleapp'), 'consoleapp'],
      [t('app.sysprofiler'), 'sysprofiler'], [t('app.netutil'), 'netutil'], [t('app.fontbook'), 'fontbook'],
      [t('app.opengl'), 'opengl'], [t('app.keychain'), 'keychain'], [t('app.grab'), 'grab'],
      [t('app.migration'), 'migration'], [t('app.bootcamp'), 'bootcamp'],
    ];
    const childPath = (parent, name) => parent === '/' ? `/${name}` : `${parent}/${name}`;
    const parentPath = (path) => path.slice(0, path.lastIndexOf('/')) || '/';
    const seed = demoSeed();
    const preserveConflict = (p, parent) => {
      const base = p.slice(p.lastIndexOf('/') + 1);
      let name = `${base}${seed.userFileSuffix}`, i = 2;
      while (tree[childPath(parent, name)]) name = `${base}${seed.userFileSuffixN(i++)}`;
      const dst = childPath(parent, name);
      Object.keys(tree)
        .filter((k) => k === p || k.startsWith(p + '/'))
        .sort((a, b) => a.length - b.length)
        .forEach((k) => {
          tree[dst + k.slice(p.length)] = tree[k];
          delete tree[k];
        });
      const siblings = tree[parent] && tree[parent].children;
      const idx = Array.isArray(siblings) ? siblings.indexOf(base) : -1;
      if (idx >= 0) siblings[idx] = name;
      else if (Array.isArray(siblings)) siblings.push(name);
    };
    const put = (p, node, parent) => {
      if (tree[p] && tree[p].type !== node.type) preserveConflict(p, parent);
      if (!tree[p]) {
        tree[p] = node;
        const base = p.slice(p.lastIndexOf('/') + 1);
        if (tree[parent] && !tree[parent].children.includes(base)) tree[parent].children.push(base);
      } else if (node.type === 'app' || node.type === 'kext') {
        tree[p] = Object.assign({}, tree[p], node); // keep managed metadata fresh without losing dates/id
      }
    };
    put('/应用程序', { type: 'dir', children: [] }, '/');
    // Reconcile saved trees against the current application registry. This
    // removes obsolete managed app nodes and aliases without encoding a list of
    // previously bundled apps or touching ordinary user files.
    const installedAppIds = new Set([...apps, ...utils].map(([, id]) => id));
    const removeNode = (path) => {
      const parent = parentPath(path);
      const itemName = path.slice(path.lastIndexOf('/') + 1);
      Object.keys(tree)
        .filter((candidate) => candidate === path || candidate.startsWith(path + '/'))
        .forEach((candidate) => delete tree[candidate]);
      const children = tree[parent]?.children;
      if (!Array.isArray(children)) return;
      const index = children.indexOf(itemName);
      if (index >= 0) children.splice(index, 1);
    };
    const staleAppPaths = Object.entries(tree)
      .filter(([, node]) => node?.type === 'app' && !installedAppIds.has(node.appId))
      .map(([path]) => path)
      .sort((a, b) => a.length - b.length)
      .filter((path, index, paths) => !paths.slice(0, index).some((root) => path.startsWith(root + '/')));
    const emptiedRootFolders = new Set(staleAppPaths.map(parentPath));
    staleAppPaths.forEach(removeNode);
    emptiedRootFolders.forEach((path) => {
      if (path !== '/应用程序' && parentPath(path) === '/' && tree[path]?.type === 'dir' && tree[path].children.length === 0) {
        removeNode(path);
      }
    });
    put('/资料库', { type: 'dir', children: [] }, '/');
    put('/资料库/Application Support', { type: 'dir', children: [] }, '/资料库');
    put('/资料库/Fonts', { type: 'dir', children: [] }, '/资料库');
    put('/资料库/Preferences', { type: 'dir', children: [] }, '/资料库');
    put(paths.downloads, { type: 'dir', children: [] }, paths.home);
    put(paths.movies, { type: 'dir', children: [] }, paths.home);
    put(paths.public, { type: 'dir', children: [] }, paths.home);
    put(paths.sites, { type: 'dir', children: [] }, paths.home);
    put(`${paths.downloads}/欢迎使用 Safari.txt`, {
      type: 'file',
      content: '从 Safari 下载的项目会出现在这里，也会显示在 Dock 的“下载”堆栈中。',
    }, paths.downloads);
    put('/应用程序/实用工具', { type: 'dir', children: [] }, '/应用程序');
    const reconcileManagedApps = (entries, parent) => {
      const childOrder = tree[parent]?.children || [];
      entries.forEach(([name, id]) => {
        const candidates = Object.entries(tree)
          .filter(([path, node]) => parentPath(path) === parent
            && node?.type === 'app' && node.appId === id)
          .map(([path, node]) => ({ path, node }))
          .sort((left, right) => {
            // Prefer the original installed application over aliases, then
            // preserve the directory order from the user's existing disk.
            const aliasOrder = Number(!!left.node.alias) - Number(!!right.node.alias);
            if (aliasOrder) return aliasOrder;
            const leftIndex = childOrder.indexOf(left.path.slice(left.path.lastIndexOf('/') + 1));
            const rightIndex = childOrder.indexOf(right.path.slice(right.path.lastIndexOf('/') + 1));
            return leftIndex - rightIndex || left.path.localeCompare(right.path);
          });
        const keep = candidates.shift();
        candidates.forEach(({ path }) => removeNode(path));
        if (keep) {
          tree[keep.path] = Object.assign({}, keep.node, { type:'app', appId:id, alias:false });
        } else {
          put(`${parent}/${name}.app`, { type:'app', appId:id }, parent);
        }
      });
    };
    // Physical names from an existing disk remain stable. Old builds could
    // add a second localized node for the same appId after a language change;
    // only those managed duplicates are removed. User files are untouched.
    reconcileManagedApps(apps, '/应用程序');
    reconcileManagedApps(utils, '/应用程序/实用工具');
    put(paths.trash, { type: 'dir', children: [] }, paths.home);
    put('/系统/扩展', { type: 'dir', children: [] }, '/系统');
    const kexts = [
      ['System.kext', getLocale() === 'en' ? 'System core services' : '系统核心服务', '9.8.0'],
      ['QuartzExtreme.kext', getLocale() === 'en' ? 'GPU compositing (shadows/transparency/animation)' : 'GPU 合成加速（卸载后失去阴影/透明/动画）', '1.5.2'],
      ['AppleHDA.kext', getLocale() === 'en' ? 'High Definition Audio (WebAudio)' : '高保真音频驱动 (WebAudio)', '1.7.1'],
      ['IONetworkingFamily.kext', getLocale() === 'en' ? 'Networking stack (fetch)' : '网络协议栈 (fetch)', '2.0'],
      ['AppleIntelGMA.kext', getLocale() === 'en' ? 'Graphics driver (WebGL)' : '图形驱动 (WebGL)', '5.4.8'],
      ['IOUSBFamily.kext', getLocale() === 'en' ? 'USB bus driver' : 'USB 总线驱动', '3.5.2'],
    ];
    kexts.forEach(([name, desc, ver]) => put(`/系统/扩展/${name}`, { type: 'kext', desc, ver }, '/系统/扩展'));
  }

  function validTreeStructure(t) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) return false;
    const entries = Object.entries(t);
    if (!entries.every(([p, node]) => {
      if (typeof p !== 'string' || normalize(p) !== p || !node || typeof node !== 'object' || Array.isArray(node)) return false;
      if (node.type === 'dir') {
        return Array.isArray(node.children)
          && node.children.every((name) => typeof name === 'string' && name && name !== '.' && name !== '..' && !name.includes('/'))
          && new Set(node.children).size === node.children.length;
      }
      return typeof node.type === 'string';
    })) return false;

    // Every directory entry must point to a real node, and every non-root node
    // must be listed by its parent. This rejects ghost entries and orphan paths.
    for (const [p, node] of entries) {
      if (node.type === 'dir') {
        for (const name of node.children) {
          const child = p === '/' ? `/${name}` : `${p}/${name}`;
          if (!Object.prototype.hasOwnProperty.call(t, child)) return false;
        }
      }
      if (p !== '/') {
        const parent = parentOf(p);
        const parentNode = t[parent];
        if (!parentNode || parentNode.type !== 'dir' || !parentNode.children.includes(baseName(p))) return false;
      }
    }
    return true;
  }

  function validTree(t) {
    if (!validTreeStructure(t)) return false;
    const requiredDirs = ['/', paths.users, paths.home, '/系统'];
    if (!requiredDirs.every((p) => t[p] && t[p].type === 'dir' && Array.isArray(t[p].children))) return false;
    const managedDirs = ['/应用程序', '/应用程序/实用工具', '/系统/扩展', paths.trash];
    return !managedDirs.some((p) => t[p] && (t[p].type !== 'dir' || !Array.isArray(t[p].children)));
  }

  const pathMetadataKeys = new Set([
    'path', 'paths', 'from', 'target', 'source', 'destination', 'directory',
    'folder', 'home', 'parent', 'workingDirectory', 'attachmentPath',
  ]);
  const nonPathPayloadKeys = new Set(['content', 'src', 'richText', 'html', 'text', 'data', 'url']);

  function rewriteLegacyPath(value) {
    if (typeof value !== 'string') return value;
    if (value === VFS_LEGACY_HOME) return paths.home;
    return value.startsWith(VFS_LEGACY_HOME + '/')
      ? paths.home + value.slice(VFS_LEGACY_HOME.length)
      : value;
  }

  function rewritePathMetadata(value, key = '', seen = new WeakSet()) {
    if (typeof value === 'string') return pathMetadataKeys.has(key) ? rewriteLegacyPath(value) : value;
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        value[index] = key === 'paths'
          ? rewriteLegacyPath(value[index])
          : rewritePathMetadata(value[index], key, seen);
      }
      return value;
    }
    Object.keys(value).forEach((childKey) => {
      if (nonPathPayloadKeys.has(childKey)) return;
      value[childKey] = rewritePathMetadata(value[childKey], childKey, seen);
    });
    return value;
  }

  /**
   * Convert a structurally valid legacy disk in memory.  The clone-and-validate
   * flow makes the replacement atomic from the VFS point of view: callers
   * either receive a complete new tree or the untouched source tree.
   */
  function migrateLegacyHome(stored) {
    if (VFS_LEGACY_HOME === paths.home || !validTreeStructure(stored)) return null;
    if (stored[paths.home]?.type === 'dir') return null; // never merge over a valid configured home
    if (stored[VFS_LEGACY_HOME]?.type !== 'dir') return null;

    const migrated = JSON.parse(JSON.stringify(stored));
    const legacyPaths = Object.keys(migrated)
      .filter((path) => path === VFS_LEGACY_HOME || path.startsWith(VFS_LEGACY_HOME + '/'))
      .sort((a, b) => a.length - b.length);
    legacyPaths.forEach((oldPath) => {
      const newPath = paths.home + oldPath.slice(VFS_LEGACY_HOME.length);
      if (Object.prototype.hasOwnProperty.call(migrated, newPath)) return;
      migrated[newPath] = migrated[oldPath];
      delete migrated[oldPath];
    });

    const users = migrated[paths.users];
    if (!users || users.type !== 'dir' || !Array.isArray(users.children)) return null;
    users.children = users.children
      .map((name) => name === VFS_LEGACY_HOME.slice(VFS_LEGACY_HOME.lastIndexOf('/') + 1) ? HOME_USER : name)
      .filter((name, index, all) => all.indexOf(name) === index);
    if (!users.children.includes(HOME_USER)) users.children.push(HOME_USER);
    Object.values(migrated).forEach((node) => rewritePathMetadata(node));
    return validTree(migrated) ? migrated : null;
  }

  let tree;
  let initialPersistAllowed = true;
  try {
    const raw = localStorage.getItem(KEY);
    const stored = raw ? JSON.parse(raw) : null;
    if (validTree(stored)) {
      tree = stored;
    } else {
      const migrated = migrateLegacyHome(stored);
      if (migrated) {
        try {
          if (localStorage.getItem(VFS_HOME_MIGRATION_BACKUP_KEY) == null) {
            localStorage.setItem(VFS_HOME_MIGRATION_BACKUP_KEY, raw);
          }
          tree = migrated;
        } catch (error) {
          // Never overwrite the only legacy copy when the safety backup could
          // not be written (for example because localStorage quota is full).
          tree = migrated;
          initialPersistAllowed = false;
          console.warn('Leopard Web: HOME migration is read-only until its backup can be saved.', error);
        }
      } else {
        tree = defaults();
      }
    }
  } catch (e) {
    tree = defaults();
  }
  ensureSystem(tree);
  ensureMetadata(tree);
  if (!validTree(tree)) {
    tree = defaults();
    ensureSystem(tree);
    ensureMetadata(tree);
  }
  const storage = createVFSStorage({ key: KEY });
  if (initialPersistAllowed) {
    try { localStorage.setItem(KEY, JSON.stringify(tree)); }
    catch (error) { storage.reportError(error, 'bootstrap-localstorage'); }
  } else {
    storage.reportError(new Error('HOME migration backup could not be saved'), 'home-migration-backup');
  }

  // IndexedDB hydration completes before main.js registers applications or
  // starts the desktop.  The mutation guard protects embedders that call the
  // synchronous API before awaiting ready: their in-memory edits win and the
  // queued persistence write remains authoritative.
  const ready = storage.initialize(tree, { allowInitialWrite: initialPersistAllowed })
    .then((result) => {
      if (mutationVersion || !result?.tree) return true;
      const candidate = result.tree;
      if (!validTree(candidate)) {
        storage.reportError(new Error('Persisted VFS tree failed structural validation'), 'validate-hydrated-tree');
        return false;
      }
      const beforeSystemRefresh = JSON.stringify(candidate);
      ensureSystem(candidate);
      ensureMetadata(candidate);
      if (!validTree(candidate)) {
        storage.reportError(new Error('Persisted VFS tree failed validation after system reconciliation'), 'reconcile-hydrated-tree');
        return false;
      }
      tree = candidate;
      if (JSON.stringify(candidate) !== beforeSystemRefresh && initialPersistAllowed) storage.save(candidate);
      return true;
    })
    .catch((error) => {
      storage.reportError(error, 'hydrate-vfs');
      return false;
    });

  function emitHistoryChanged() {
    try {
      document.dispatchEvent(new CustomEvent('vfs-history-changed', {
        detail: {
          canUndo: !!undoStack.length, canRedo: !!redoStack.length,
          undoLabel: undoStack.at(-1)?.label || '', redoLabel: redoStack.at(-1)?.label || '',
        },
      }));
    } catch (e) {}
  }

  function save(change) {
    if (!initialPersistAllowed) return false;
    mutationVersion++;
    // Persistence is asynchronous and serialized by vfs-storage.js. A later
    // quota/IDB failure is surfaced through storageStatus and the
    // vfs-storage-status event; it must not roll back newer dependent edits.
    storage.save(tree);
    try { document.dispatchEvent(new CustomEvent('vfs-changed', { detail: change || null })); } catch (e) {}
    return true;
  }

  function snapshot() {
    return JSON.stringify(tree);
  }

  function historyPatch(before, after) {
    const previous = JSON.parse(before);
    const next = JSON.parse(after);
    const paths = new Set([...Object.keys(previous), ...Object.keys(next)]);
    const patch = [];
    paths.forEach((path) => {
      const oldNode = Object.prototype.hasOwnProperty.call(previous, path) ? previous[path] : null;
      const newNode = Object.prototype.hasOwnProperty.call(next, path) ? next[path] : null;
      if (JSON.stringify(oldNode) === JSON.stringify(newNode)) return;
      patch.push({ path, before: oldNode, after: newNode });
    });
    return patch;
  }

  function applyHistoryPatch(patch, side) {
    patch.forEach((entry) => {
      const value = entry[side];
      if (value == null) delete tree[entry.path];
      else tree[entry.path] = JSON.parse(JSON.stringify(value));
    });
  }

  function recordHistory(before, after, change) {
    if (historySuppressed || before === after || change?.record === false) return;
    const patch = historyPatch(before, after);
    if (!patch.length) return;
    undoStack.push({
      patch,
      label: change?.label || '文件操作',
      type: change?.type || 'change',
      paths: Array.isArray(change?.paths) ? change.paths.slice() : [],
    });
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    emitHistoryChanged();
  }

  function commit(before, change) {
    if (!validTree(tree)) {
      tree = JSON.parse(before);
      return false;
    }
    const after = snapshot();
    if (save(change)) {
      recordHistory(before, after, change);
      return true;
    }
    tree = JSON.parse(before);
    return false;
  }

  function touch(path, timestamp) {
    const node = tree[normalize(path)];
    if (node) node.modifiedAt = timestamp || now();
  }

  function undo() {
    const entry = undoStack.pop();
    if (!entry) return false;
    const current = snapshot();
    applyHistoryPatch(entry.patch, 'before');
    if (!validTree(tree) || !save({ type:'undo', label:entry.label, paths:entry.paths })) {
      tree = JSON.parse(current);
      undoStack.push(entry);
      return false;
    }
    redoStack.push(entry);
    emitHistoryChanged();
    return entry;
  }

  function redo() {
    const entry = redoStack.pop();
    if (!entry) return false;
    const current = snapshot();
    applyHistoryPatch(entry.patch, 'after');
    if (!validTree(tree) || !save({ type:'redo', label:entry.label, paths:entry.paths })) {
      tree = JSON.parse(current);
      redoStack.push(entry);
      return false;
    }
    undoStack.push(entry);
    emitHistoryChanged();
    return entry;
  }

  function transaction(label, callback, options) {
    const before = snapshot();
    historySuppressed++;
    let result;
    try { result = callback(); }
    catch (error) {
      tree = JSON.parse(before);
      save({ type:'rollback', label });
      throw error;
    } finally { historySuppressed--; }
    const after = snapshot();
    if (before !== after) recordHistory(before, after, {
      type:'transaction', label, record:options?.record,
      paths:options?.paths,
    });
    return result;
  }

  function normalize(p) {
    if (!p.startsWith('/')) p = '/' + p;
    const parts = [];
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return '/' + parts.join('/');
  }

  function get(p) { return tree[normalize(p)] || null; }
  function isDir(p) { const n = get(p); return n && n.type === 'dir'; }
  function list(p) {
    const n = get(p);
    return n && n.type === 'dir' ? n.children.slice() : null;
  }
  function parentOf(p) {
    p = normalize(p);
    if (p === '/') return '/';
    return normalize(p.slice(0, p.lastIndexOf('/')) || '/');
  }
  function baseName(p) {
    p = normalize(p);
    return p === '/' ? '/' : p.slice(p.lastIndexOf('/') + 1);
  }

  function writeFile(p, content) {
    p = normalize(p);
    if (p === '/' || (tree[p] && tree[p].type !== 'file')) return false;
    const parent = parentOf(p);
    if (!isDir(parent)) return false;
    const before = snapshot();
    const time = now();
    const previous = tree[p];
    if (!previous) tree[parent].children.push(baseName(p));
    tree[p] = enrichNode({
      type: 'file', content,
      id: previous?.id,
      createdAt: previous?.createdAt,
      modifiedAt: time,
    }, time);
    touch(parent, time);
    return commit(before, {
      type: previous ? 'write' : 'create',
      label: `${previous ? '存储' : '创建'}“${baseName(p)}”`,
      paths: [p],
    });
  }

  function mkdir(p) {
    p = normalize(p);
    if (p === '/' || tree[p]) return false;
    const parent = parentOf(p);
    if (!isDir(parent)) return false;
    const before = snapshot();
    const time = now();
    tree[parent].children.push(baseName(p));
    tree[p] = enrichNode({ type: 'dir', children: [] }, time);
    touch(parent, time);
    return commit(before, { type:'mkdir', label:`新建文件夹“${baseName(p)}”`, paths:[p] });
  }

  function removeNode(p) {
    p = normalize(p);
    const n = tree[p];
    if (!n || p === '/') return false;
    if (n.type === 'dir') for (const c of n.children.slice()) removeNode(p + '/' + c);
    const parent = parentOf(p);
    const siblings = tree[parent] && Array.isArray(tree[parent].children) ? tree[parent].children : null;
    const idx = siblings ? siblings.indexOf(baseName(p)) : -1;
    if (idx >= 0) siblings.splice(idx, 1);
    delete tree[p];
    return true;
  }

  function remove(p, options) {
    p = normalize(p);
    const before = snapshot();
    if (!removeNode(p)) return false;
    touch(parentOf(p));
    return commit(before, {
      type:'remove', label:options?.label || `删除“${baseName(p)}”`,
      paths:[p], record:options?.record,
    });
  }

  // Move a file/dir (with all descendants) into dstDir. Returns the new path, or false.
  function move(src, dstDir, options) {
    src = normalize(src); dstDir = normalize(dstDir);
    if (!tree[src] || src === '/' || !isDir(dstDir)) return false;
    if (dstDir === src || dstDir.startsWith(src + '/')) return false;
    const before = snapshot();
    const time = now();
    const base = baseName(src);
    let name = String(options?.name || base).trim();
    if (!name || name.includes('/')) return false;
    if (parentOf(src) === dstDir && name === base) return src;
    let dst = normalize(dstDir + '/' + name);
    if (tree[dst]) {
      if (options?.conflict === 'error') return false;
      if (options?.conflict === 'replace') {
        if (!removeNode(dst)) return false;
      } else {
        const dot = base.lastIndexOf('.');
        name = uniqueName(dstDir, dot > 0 ? base.slice(0, dot) : base, dot > 0 ? base.slice(dot) : '');
        dst = normalize(dstDir + '/' + name);
      }
    }
    if (options?.sourcePatch && typeof options.sourcePatch === 'object') {
      Object.entries(options.sourcePatch).forEach(([key, value]) => {
        if (value == null) delete tree[src][key];
        else tree[src][key] = value;
      });
    }
    Object.keys(tree)
      .filter((k) => k === src || k.startsWith(src + '/'))
      .forEach((k) => { tree[dst + k.slice(src.length)] = tree[k]; delete tree[k]; });
    const sp = parentOf(src);
    const idx = tree[sp].children.indexOf(base);
    if (idx >= 0) tree[sp].children.splice(idx, 1);
    tree[dstDir].children.push(name);
    touch(dst, time); touch(sp, time); touch(dstDir, time);
    return commit(before, {
      type:'move', label:options?.label || `移动“${base}”`,
      paths:[src,dst], record:options?.record,
    }) ? dst : false;
  }

  function uniqueName(dir, base, ext) {
    let name = base + ext, i = 2;
    while (get(normalize(dir + '/' + name))) name = `${base} ${i++}${ext}`;
    return name;
  }

  function walk(root) {
    root = normalize(root || '/');
    if (!tree[root]) return [];
    return Object.keys(tree)
      .filter((p) => p === root || p.startsWith(root === '/' ? '/' : root + '/'))
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }

  function copy(src, dstDir, options) {
    src = normalize(src); dstDir = normalize(dstDir);
    if (!tree[src] || src === '/' || !isDir(dstDir)) return false;
    const before = snapshot();
    const time = now();
    const base = baseName(src);
    const dot = base.lastIndexOf('.');
    let name = String(options?.name || base).trim();
    if (!name || name.includes('/')) return false;
    let existing = tree[normalize(dstDir + '/' + name)];
    if (existing && options?.conflict === 'error') return false;
    if (existing && options?.conflict === 'replace') removeNode(normalize(dstDir + '/' + name));
    else if (existing) {
      name = uniqueName(dstDir, dot > 0 ? base.slice(0, dot) + ' 副本' : base + ' 副本', dot > 0 ? base.slice(dot) : '');
    }
    const dst = normalize(dstDir + '/' + name);
    Object.keys(tree)
      .filter((k) => k === src || k.startsWith(src + '/'))
      .sort((a, b) => a.length - b.length)
      .forEach((k) => {
        const clone = JSON.parse(JSON.stringify(tree[k]));
        enrichNode(clone, time, true);
        tree[dst + k.slice(src.length)] = clone;
      });
    tree[dstDir].children.push(name);
    touch(dstDir, time);
    return commit(before, {
      type:'copy', label:options?.label || `拷贝“${base}”`,
      paths:[src,dst], record:options?.record,
    }) ? dst : false;
  }

  function rename(src, nextName) {
    src = normalize(src);
    nextName = String(nextName || '').trim();
    if (!tree[src] || src === '/' || !nextName || nextName.includes('/') || nextName === '.' || nextName === '..') return false;
    const parent = parentOf(src);
    const dst = normalize(parent + '/' + nextName);
    if (tree[dst]) return false;
    const before = snapshot();
    const time = now();
    Object.keys(tree)
      .filter((k) => k === src || k.startsWith(src + '/'))
      .sort((a, b) => a.length - b.length)
      .forEach((k) => { tree[dst + k.slice(src.length)] = tree[k]; delete tree[k]; });
    const idx = tree[parent].children.indexOf(baseName(src));
    if (idx >= 0) tree[parent].children[idx] = nextName;
    touch(dst, time); touch(parent, time);
    return commit(before, { type:'rename', label:`重新命名“${baseName(src)}”`, paths:[src,dst] }) ? dst : false;
  }

  function sizeOf(path) {
    path = normalize(path);
    const node = tree[path];
    if (!node) return 0;
    if (node.type === 'dir') {
      return Object.keys(tree)
        .filter((candidate) => candidate.startsWith(path === '/' ? '/' : `${path}/`) && tree[candidate]?.type !== 'dir')
        .reduce((total, candidate) => total + sizeOf(candidate), 0);
    }
    if (node.__vfsBlobs?.content?.size && typeof node.content === 'string' && node.content.startsWith('blob:')) {
      return node.__vfsBlobs.content.size;
    }
    if (node.content != null) return byteSize(node.content);
    if (typeof node.src === 'string' && node.src.startsWith('data:')) {
      const comma = node.src.indexOf(',');
      if (comma >= 0) {
        const payload = node.src.slice(comma + 1);
        if (node.src.slice(0, comma).includes(';base64')) {
          return Math.max(0, Math.floor(payload.length * 3 / 4) - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0));
        }
        try { return byteSize(decodeURIComponent(payload)); }
        catch (e) { return byteSize(payload); }
      }
    }
    const externalSize = node.__vfsBlobs?.src?.size
      || node.__vfsBlobs?.data?.size
      || node.__vfsBlobs?.blob?.size
      || node.__vfsBlobs?.content?.size;
    if (Number.isFinite(externalSize)) return externalSize;
    return Number.isFinite(node.size) ? node.size : 0;
  }

  function updateNode(path, patch, label) {
    path = normalize(path);
    const node = tree[path];
    if (!node || !patch || typeof patch !== 'object') return false;
    const before = snapshot();
    const allowed = ['label','kind','mime','src','content','from','comment','tags','locked','hidden'];
    allowed.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) return;
      if (patch[key] == null) delete node[key];
      else node[key] = patch[key];
    });
    touch(path);
    return commit(before, {
      type:'metadata', label:label || `更改“${baseName(path)}”`,
      paths:[path],
    });
  }

  function exportTree() {
    return JSON.parse(snapshot());
  }

  function importTree(nextTree) {
    const before = snapshot();
    try {
      const candidate = JSON.parse(JSON.stringify(nextTree));
      ensureSystem(candidate);
      ensureMetadata(candidate);
      if (!validTree(candidate)) return false;
      tree = candidate;
      return commit(before, { type:'import', label:'导入虚拟磁盘' });
    } catch (e) {
      tree = JSON.parse(before);
      return false;
    }
  }

  function storageStatus() {
    const current = storage.status();
    const historyBytes = [...undoStack, ...redoStack]
      .reduce((total, entry) => total + byteSize(JSON.stringify(entry.patch)), 0);
    return { ...current, historyBytes };
  }

  return { get, list, isDir, writeFile, mkdir, remove, move, copy, rename, walk, exportTree, importTree,
           normalize, parentOf, baseName, uniqueName, sizeOf, updateNode, undo, redo, transaction,
           ready, flush: () => ready.then(() => storage.flush()), storageStatus, getStorageStatus:storageStatus,
           canUndo: () => !!undoStack.length, canRedo: () => !!redoStack.length,
           undoLabel: () => undoStack.at(-1)?.label || '', redoLabel: () => redoStack.at(-1)?.label || '',
           putNode(p, node) {
             p = normalize(p);
             const parent = parentOf(p);
             if (p === '/' || !isDir(parent) || !node || typeof node !== 'object' || Array.isArray(node)
                 || typeof node.type !== 'string' || (node.type === 'dir' && !Array.isArray(node.children))
                 || (node.type === 'dir' && (node.children.length || tree[p]))
                 || (tree[p] && tree[p].type === 'dir')) return false;
             const before = snapshot();
             const time = now();
             if (!tree[p]) tree[parent].children.push(baseName(p));
             const previous = tree[p];
             tree[p] = enrichNode(Object.assign({}, node, {
               id: previous?.id || node.id,
               createdAt: previous?.createdAt || node.createdAt,
               modifiedAt: time,
             }), time);
             touch(parent, time);
             return commit(before, {
               type:previous ? 'write' : 'create',
               label:`${previous ? '更新' : '创建'}“${baseName(p)}”`,
               paths:[p],
             });
           },
           reset() {
             const before = snapshot();
             tree = defaults();
             ensureSystem(tree);
             ensureMetadata(tree);
             return commit(before, { type:'reset', label:'还原虚拟磁盘', record:false });
           } };
})();
