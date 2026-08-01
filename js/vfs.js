// Virtual file system, persisted in localStorage. Shared by Finder, Terminal, TextEdit.
const VFS = (() => {
  const KEY = 'macweb.vfs.v1';
  const HISTORY_LIMIT = 50;
  let undoStack = [];
  let redoStack = [];
  let historySuppressed = 0;

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

  function defaults() {
    return {
      '/': { type: 'dir', children: ['应用程序', '资料库', '系统', '用户'] },
      '/资料库': { type: 'dir', children: ['Application Support', 'Fonts', 'Preferences'] },
      '/资料库/Application Support': { type: 'dir', children: [] },
      '/资料库/Fonts': { type: 'dir', children: [] },
      '/资料库/Preferences': { type: 'dir', children: [] },
      '/用户': { type: 'dir', children: ['roll'] },
      '/用户/roll': { type: 'dir', children: ['桌面', '文稿', '下载', '影片', '图片', '音乐', '公共', '站点', 'README.txt', '.废纸篓'] },
      '/用户/roll/.废纸篓': { type: 'dir', children: [] },
      '/用户/roll/桌面': { type: 'dir', children: ['欢迎.txt'] },
      '/用户/roll/桌面/欢迎.txt': { type: 'file', content: '欢迎来到 Mac OS X Leopard 网页版！\n\n双击 .txt 文件会用「文本编辑」打开。\n试试 Dock 里的各个应用吧。' },
      '/用户/roll/文稿': { type: 'dir', children: ['购物清单.txt', '日记.txt'] },
      '/用户/roll/文稿/购物清单.txt': { type: 'file', content: '牛奶\n鸡蛋\n面包\n咖啡豆' },
      '/用户/roll/文稿/日记.txt': { type: 'file', content: '今天在浏览器里装了一台 Mac。\n感觉不错。' },
      '/用户/roll/图片': { type: 'dir', children: ['极光.svg', '虎纹波浪.svg'] },
      '/用户/roll/图片/极光.svg': { type: 'file', kind: 'image', src: 'assets/aurora.svg' },
      '/用户/roll/图片/虎纹波浪.svg': { type: 'file', kind: 'image', src: 'assets/tiger.svg' },
      '/用户/roll/音乐': { type: 'dir', children: [] },
      '/用户/roll/下载': { type: 'dir', children: ['欢迎使用 Safari.txt'] },
      '/用户/roll/下载/欢迎使用 Safari.txt': { type: 'file', content: '从 Safari 下载的项目会出现在这里，也会显示在 Dock 的“下载”堆栈中。' },
      '/用户/roll/影片': { type: 'dir', children: [] },
      '/用户/roll/公共': { type: 'dir', children: [] },
      '/用户/roll/站点': { type: 'dir', children: ['index.html'] },
      '/用户/roll/站点/index.html': { type: 'file', content: '<!doctype html><title>roll 的网站</title><h1>欢迎</h1>' },
      '/用户/roll/README.txt': { type: 'file', content: '这是一个纯前端实现的 Mac OS X。\n文件保存在浏览器 localStorage 中。' },
      '/应用程序': { type: 'dir', children: [] },
      '/系统': { type: 'dir', children: ['版本.txt'] },
      '/系统/版本.txt': { type: 'file', content: 'Mac OS X 10.5 Leopard (Web Edition)\nBuild 9A581-www' },
    };
  }

  // Apps/kexts injected on every load so old saved trees pick up new system files.
  function ensureSystem(t) {
    const apps = [
      ['Mail', 'mail'], ['通讯录', 'addressbook'], ['iChat', 'ichat'], ['Safari', 'safari'],
      ['iCal', 'ical'], ['iTunes', 'itunes'], ['Photo Booth', 'photobooth'], ['QuickTime Player', 'quicktime'],
      ['DVD 播放器', 'dvdplayer'], ['Front Row', 'frontrow'], ['Dictionary', 'dictionary'],
      ['Automator', 'automator'], ['图像捕捉', 'imagecapture'], ['Dashboard', 'dashboard'],
      ['Time Machine', 'timemachine'], ['备忘录', 'notes'], ['便笺', 'stickies'], ['文本编辑', 'textedit'],
      ['计算器', 'calculator'], ['终端', 'terminal'], ['预览', 'preview'], ['国际象棋', 'chess'],
      ['系统偏好设置', 'sysprefs'],
    ];
    const utils = [
      ['磁盘工具', 'diskutil'], ['活动监视器', 'activity'], ['控制台', 'consoleapp'],
      ['系统报告', 'sysprofiler'], ['网络实用工具', 'netutil'], ['字体册', 'fontbook'],
      ['OpenGL 演示', 'opengl'], ['钥匙串访问', 'keychain'], ['抓图', 'grab'],
      ['迁移助理', 'migration'], ['Boot Camp 助理', 'bootcamp'],
    ];
    const childPath = (parent, name) => parent === '/' ? `/${name}` : `${parent}/${name}`;
    const parentPath = (path) => path.slice(0, path.lastIndexOf('/')) || '/';
    const preserveConflict = (p, parent) => {
      const base = p.slice(p.lastIndexOf('/') + 1);
      let name = `${base}（用户文件）`, i = 2;
      while (t[childPath(parent, name)]) name = `${base}（用户文件 ${i++}）`;
      const dst = childPath(parent, name);
      Object.keys(t)
        .filter((k) => k === p || k.startsWith(p + '/'))
        .sort((a, b) => a.length - b.length)
        .forEach((k) => {
          t[dst + k.slice(p.length)] = t[k];
          delete t[k];
        });
      const siblings = t[parent] && t[parent].children;
      const idx = Array.isArray(siblings) ? siblings.indexOf(base) : -1;
      if (idx >= 0) siblings[idx] = name;
      else if (Array.isArray(siblings)) siblings.push(name);
    };
    const put = (p, node, parent) => {
      if (t[p] && t[p].type !== node.type) preserveConflict(p, parent);
      if (!t[p]) {
        t[p] = node;
        const base = p.slice(p.lastIndexOf('/') + 1);
        if (t[parent] && !t[parent].children.includes(base)) t[parent].children.push(base);
      } else if (node.type === 'app' || node.type === 'kext') {
        t[p] = Object.assign({}, t[p], node); // keep managed metadata fresh without losing dates/id
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
      Object.keys(t)
        .filter((candidate) => candidate === path || candidate.startsWith(path + '/'))
        .forEach((candidate) => delete t[candidate]);
      const children = t[parent]?.children;
      if (!Array.isArray(children)) return;
      const index = children.indexOf(itemName);
      if (index >= 0) children.splice(index, 1);
    };
    const staleAppPaths = Object.entries(t)
      .filter(([, node]) => node?.type === 'app' && !installedAppIds.has(node.appId))
      .map(([path]) => path)
      .sort((a, b) => a.length - b.length)
      .filter((path, index, paths) => !paths.slice(0, index).some((root) => path.startsWith(root + '/')));
    const emptiedRootFolders = new Set(staleAppPaths.map(parentPath));
    staleAppPaths.forEach(removeNode);
    emptiedRootFolders.forEach((path) => {
      if (path !== '/应用程序' && parentPath(path) === '/' && t[path]?.type === 'dir' && t[path].children.length === 0) {
        removeNode(path);
      }
    });
    put('/资料库', { type: 'dir', children: [] }, '/');
    put('/资料库/Application Support', { type: 'dir', children: [] }, '/资料库');
    put('/资料库/Fonts', { type: 'dir', children: [] }, '/资料库');
    put('/资料库/Preferences', { type: 'dir', children: [] }, '/资料库');
    put('/用户/roll/下载', { type: 'dir', children: [] }, '/用户/roll');
    put('/用户/roll/影片', { type: 'dir', children: [] }, '/用户/roll');
    put('/用户/roll/公共', { type: 'dir', children: [] }, '/用户/roll');
    put('/用户/roll/站点', { type: 'dir', children: [] }, '/用户/roll');
    put('/用户/roll/下载/欢迎使用 Safari.txt', {
      type: 'file',
      content: '从 Safari 下载的项目会出现在这里，也会显示在 Dock 的“下载”堆栈中。',
    }, '/用户/roll/下载');
    apps.forEach(([name, id]) => put(`/应用程序/${name}.app`, { type: 'app', appId: id }, '/应用程序'));
    put('/应用程序/实用工具', { type: 'dir', children: [] }, '/应用程序');
    utils.forEach(([name, id]) => put(`/应用程序/实用工具/${name}.app`, { type: 'app', appId: id }, '/应用程序/实用工具'));
    put('/用户/roll/.废纸篓', { type: 'dir', children: [] }, '/用户/roll');
    put('/系统/扩展', { type: 'dir', children: [] }, '/系统');
    const kexts = [
      ['System.kext', '系统核心服务', '9.8.0'],
      ['QuartzExtreme.kext', 'GPU 合成加速（卸载后失去阴影/透明/动画）', '1.5.2'],
      ['AppleHDA.kext', '高保真音频驱动 (WebAudio)', '1.7.1'],
      ['IONetworkingFamily.kext', '网络协议栈 (fetch)', '2.0'],
      ['AppleIntelGMA.kext', '图形驱动 (WebGL)', '5.4.8'],
      ['IOUSBFamily.kext', 'USB 总线驱动', '3.5.2'],
    ];
    kexts.forEach(([name, desc, ver]) => put(`/系统/扩展/${name}`, { type: 'kext', desc, ver }, '/系统/扩展'));
  }

  function validTree(t) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) return false;
    const requiredDirs = ['/', '/用户', '/用户/roll', '/系统'];
    if (!requiredDirs.every((p) => t[p] && t[p].type === 'dir' && Array.isArray(t[p].children))) return false;
    const managedDirs = ['/应用程序', '/应用程序/实用工具', '/系统/扩展', '/用户/roll/.废纸篓'];
    if (managedDirs.some((p) => t[p] && (t[p].type !== 'dir' || !Array.isArray(t[p].children)))) return false;
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

  let tree;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    tree = validTree(stored) ? stored : defaults();
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
  try { localStorage.setItem(KEY, JSON.stringify(tree)); } catch (e) {}

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
    try { localStorage.setItem(KEY, JSON.stringify(tree)); } catch (e) { return false; }
    try { document.dispatchEvent(new CustomEvent('vfs-changed', { detail: change || null })); } catch (e) {}
    return true;
  }

  function snapshot() {
    return JSON.stringify(tree);
  }

  function recordHistory(before, after, change) {
    if (historySuppressed || before === after || change?.record === false) return;
    undoStack.push({
      before, after,
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
    tree = JSON.parse(entry.before);
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
    tree = JSON.parse(entry.after);
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

  return { get, list, isDir, writeFile, mkdir, remove, move, copy, rename, walk, exportTree, importTree,
           normalize, parentOf, baseName, uniqueName, sizeOf, updateNode, undo, redo, transaction,
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
