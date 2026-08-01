// Leopard Finder — four views, Quick Look, content search, richer actions and menus.
(() => {
  const { el } = System;
  const previous = System.apps.finder;
  const icon = previous.icon;
  const openWindows = new Set();
  const VIEW_KEY = 'macweb.finder.view';
  const VIEW_OPTIONS_KEY = 'macweb.finder.view-options.v1';
  let preferencesWindow = null;
  let viewOptionsWindow = null;
  let clipboard = { operation: null, paths: [] };
  const SERVERS_KEY = 'macweb.finder.connected-servers.v1';
  const connectedServers = () => {
    try {
      const entries = JSON.parse(localStorage.getItem(SERVERS_KEY));
      return Array.isArray(entries)
        ? entries.filter((entry) => entry && VFS.isDir(entry.path) && entry.url && entry.name).slice(0, 8)
        : [];
    } catch (e) {
      return [];
    }
  };
  const saveConnectedServers = (entries) => {
    localStorage.setItem(SERVERS_KEY, JSON.stringify(entries.slice(0, 8)));
    document.dispatchEvent(new CustomEvent('finder-servers-changed'));
  };
  const viewOptionDefaults = () => ({
    alwaysView:'',
    arrange:'name',
    iconSize:64,
    gridSpacing:8,
    textSize:11,
    labelPosition:'bottom',
    showItemInfo:false,
    showIconPreview:true,
    background:'white',
    backgroundColor:'#ffffff',
  });
  const readViewOptions = () => {
    try {
      const value = JSON.parse(localStorage.getItem(VIEW_OPTIONS_KEY));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (e) {
      return {};
    }
  };
  const folderViewOptions = (path) => {
    const records = readViewOptions();
    const defaults = Object.assign(viewOptionDefaults(), records.__default || {});
    const record = records[VFS.normalize(path || '/')] || {};
    const options = Object.assign(defaults, record);
    if (!['icons','list','columns','cover',''].includes(options.alwaysView)) options.alwaysView = '';
    if (!['name','kind','size'].includes(options.arrange)) options.arrange = 'name';
    options.iconSize = Math.max(44, Math.min(96, Number(options.iconSize) || 64));
    options.gridSpacing = Math.max(2, Math.min(28, Number(options.gridSpacing) || 8));
    options.textSize = Math.max(9, Math.min(16, Number(options.textSize) || 11));
    options.labelPosition = options.labelPosition === 'right' ? 'right' : 'bottom';
    options.background = options.background === 'color' ? 'color' : 'white';
    if (!/^#[0-9a-f]{6}$/i.test(options.backgroundColor)) options.backgroundColor = '#ffffff';
    return options;
  };
  const writeFolderViewOptions = (path, options) => {
    const records = readViewOptions();
    records[VFS.normalize(path || '/')] = Object.assign(viewOptionDefaults(), options || {});
    localStorage.setItem(VIEW_OPTIONS_KEY, JSON.stringify(records));
  };
  const writeDefaultViewOptions = (options) => {
    const records = readViewOptions();
    records.__default = Object.assign(viewOptionDefaults(), options || {}, { alwaysView:'' });
    localStorage.setItem(VIEW_OPTIONS_KEY, JSON.stringify(records));
  };
  const toolGlyph = (name) => {
    const glyphs = {
      back: '<path d="m14 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
      forward: '<path d="m10 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
      up: '<path d="m5 14 7-7 7 7M12 7v12" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>',
      icons: '<g fill="currentColor"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></g>',
      list: '<path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><g fill="currentColor"><circle cx="5" cy="6" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="5" cy="18" r="1.5"/></g>',
      columns: '<path d="M3.5 4.5h17v15h-17zM9 5v14m6-14v14" fill="none" stroke="currentColor" stroke-width="1.6"/>',
      cover: '<path d="M4 6.5h16v11H4z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m7 15 3-4 3 2 3-4 2 3" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="9" r="1.3" fill="currentColor"/>',
      quick: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
      action: '<path d="M12 3.5v3m0 11v3m8.5-8.5h-3m-11 0h-3m14.5-6-2.2 2.2M8.2 15.8 6 18m12 0-2.2-2.2M8.2 8.2 6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${glyphs[name] || ''}</svg>`;
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const displayPath = (path) => path
    .replace(/^\/用户/, '/Users')
    .replace(/^\/应用程序/, '/Applications')
    .replace(/^\/资料库/, '/Library')
    .replace(/^\/系统/, '/System');
  const nodeIcon = (path) => System.fileIconFor?.(path) || (VFS.get(path)?.type === 'dir' ? ICONS.folder : ICONS.textfile);
  let cachedFinderPrefs = System.getFinderPreferences();
  const finderPrefs = () => cachedFinderPrefs;
  const extensionOf = (name) => {
    const index = String(name).lastIndexOf('.');
    return index > 0 && index < String(name).length - 1 ? String(name).slice(index + 1).toLocaleLowerCase('zh-CN') : '';
  };
  const displayName = (path) => {
    const node = VFS.get(path);
    const name = VFS.baseName(path);
    if (node?.type === 'app') return name.replace(/\.app$/i, '');
    if (finderPrefs().showAllExtensions || node?.type !== 'file') return name;
    const ext = extensionOf(name);
    const known = new Set([
      'txt','rtf','rtfd','html','htm','css','js','json','xml','md','csv',
      'jpg','jpeg','png','gif','svg','webp','tif','tiff','bmp',
      'pdf','mp3','m4a','aac','wav','aiff','ogg','mp4','m4v','mov','webm',
    ]);
    return ext && known.has(ext) ? name.slice(0, -(ext.length + 1)) : name;
  };
  const isImageNode = (path, node = VFS.get(path)) => node?.kind === 'image'
    || String(node?.mime || '').startsWith('image/')
    || ['jpg','jpeg','png','gif','svg','webp','tif','tiff','bmp'].includes(extensionOf(path));
  const isMovieNode = (path, node = VFS.get(path)) => node?.kind === 'video'
    || String(node?.mime || '').startsWith('video/')
    || ['mp4','m4v','mov','webm'].includes(extensionOf(path));
  const kindName = (node) => node?.type === 'dir' ? '文件夹'
    : node?.type === 'app' ? '应用程序'
    : node?.type === 'kext' ? '系统扩展'
    : node?.kind === 'image' ? '图像'
    : node?.mime === 'application/pdf' ? 'PDF 文稿'
    : '文稿';
  const formatBytes = (bytes) => {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${value.toLocaleString()} 字节`;
    const units = ['KB', 'MB', 'GB'];
    let amount = value / 1024;
    let unit = units[0];
    for (let index = 1; amount >= 1024 && index < units.length; index++) {
      amount /= 1024;
      unit = units[index];
    }
    return `${amount >= 10 ? amount.toFixed(1) : amount.toFixed(2)} ${unit}`;
  };
  const formatDate = (timestamp, long = false) => {
    const value = Number(timestamp);
    if (!Number.isFinite(value)) return '—';
    return new Date(value).toLocaleString('zh-CN', long
      ? { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }
      : { year:'numeric', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
  };

  function selectedPath(win) {
    return win._finderSelected || null;
  }

  function frontFinderWindow() {
    for (let index = System.windows.length - 1; index >= 0; index--) {
      const win = System.windows[index];
      if (openWindows.has(win) && win.isConnected && win.style.display !== 'none' && !win._closing) return win;
    }
    return null;
  }

  function selectedPaths(win) {
    if (!win) return [];
    if (!win._finderSelection) win._finderSelection = new Set(win._finderSelected ? [win._finderSelected] : []);
    return [...win._finderSelection].filter((path) => VFS.get(path));
  }

  function refreshSelection(win) {
    const selected = new Set(selectedPaths(win));
    if (win._finderSelected && !selected.has(win._finderSelected)) win._finderSelected = selected.values().next().value || null;
    win.querySelectorAll('.f-icon,.finder-list-row,.cover-strip-item,.column-item').forEach((node) =>
      node.classList.toggle('sel', selected.has(node.dataset.path)));
    if (win._status) {
      if (!selected.size) win._status.textContent = `${fileRows(win).length} 项`;
      else if (selected.size > 1) win._status.textContent = `已选择 ${selected.size} 项`;
      else {
        const path = selected.values().next().value;
        const node = VFS.get(path);
        win._status.textContent = node
          ? `已选择 1 项 — ${node.type === 'dir' ? `${(VFS.list(path) || []).length} 个项目，${formatBytes(VFS.sizeOf(path))}` : formatBytes(VFS.sizeOf(path))}`
          : '';
      }
    }
    updatePreview(win);
  }

  function clearSelection(win) {
    win._finderSelection = new Set();
    win._finderSelected = null;
    refreshSelection(win);
  }

  function setSelected(win, path, item, mode = 'replace') {
    if (!win._finderSelection) win._finderSelection = new Set();
    const selection = win._finderSelection;
    if (mode === 'range' && win._finderAnchor) {
      const rows = fileRows(win);
      const from = rows.indexOf(win._finderAnchor);
      const to = rows.indexOf(path);
      if (from >= 0 && to >= 0) {
        selection.clear();
        rows.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((p) => selection.add(p));
      }
    } else if (mode === 'toggle') {
      if (selection.has(path)) selection.delete(path);
      else selection.add(path);
      win._finderAnchor = path;
    } else if (mode === 'add') {
      selection.add(path);
      win._finderAnchor = path;
    } else {
      selection.clear();
      selection.add(path);
      win._finderAnchor = path;
    }
    win._finderSelected = selection.has(path) ? path : (selection.values().next().value || null);
    if (item && selection.has(path)) item.classList.add('sel');
    refreshSelection(win);
  }

  function openPath(win, path, push = true, sidebarRoute = '') {
    path = VFS.normalize(path);
    if (!VFS.isDir(path)) return;
    if (push && win._path && win._path !== path) {
      win._back.push(win._path);
      win._forward.length = 0;
    }
    win._path = path;
    win._sidebarRoute = sidebarRoute;
    win._columnTrail = [];
    win._finderSelected = null;
    win._finderSelection = new Set();
    render(win);
  }

  function createFolder(win) {
    if (!win || !VFS.isDir(win._path)) return;
    const suggested = VFS.uniqueName(win._path, '未命名文件夹', '');
    System.promptSheet({
      parent: win, title: '新建文件夹', message: '请输入新文件夹的名称：',
      value: suggested, okLabel: '新建',
      validate: (name) => !name.includes('/') && name !== '.' && name !== '..'
        && !VFS.get(`${win._path}/${name}`) || '这个名称不可用，或已有同名项目。',
      onOK: (name) => {
        const path = VFS.normalize(`${win._path}/${name}`);
        if (!VFS.mkdir(path)) return false;
        win._finderSelection = new Set([path]);
        win._finderSelected = path;
        render(win);
        return true;
      },
    });
  }

  function duplicateSelection(win) {
    const paths = selectedPaths(win);
    if (!win || !paths.length) return;
    const copies = [];
    VFS.transaction(paths.length === 1 ? `复制“${VFS.baseName(paths[0])}”` : `复制 ${paths.length} 个项目`, () => {
      paths.forEach((path) => {
        const copy = VFS.copy(path, VFS.parentOf(path));
        if (copy) copies.push(copy);
      });
    }, { paths });
    if (!copies.length) return;
    win._finderSelection = new Set(copies);
    win._finderSelected = copies[0];
    win._finderAnchor = copies[0];
    render(win);
  }

  function makeAliases(win) {
    const paths = selectedPaths(win);
    if (!win || !paths.length) return;
    const aliases = [];
    VFS.transaction(paths.length === 1 ? '制作替身' : `制作 ${paths.length} 个替身`, () => {
      paths.forEach((path) => {
        const parent = VFS.parentOf(path);
        const aliasName = VFS.uniqueName(parent, `${VFS.baseName(path)} 的替身`, '');
        const aliasPath = VFS.normalize(`${parent}/${aliasName}`);
        if (VFS.putNode(aliasPath, {
          type:'file', kind:'alias', target:path,
          content:`Mac OS X Finder alias\n${path}`,
        })) aliases.push(aliasPath);
      });
    }, { paths });
    if (!aliases.length) return;
    win._finderSelection = new Set(aliases);
    win._finderSelected = aliases[0];
    win._finderAnchor = aliases[0];
    render(win);
  }

  function goToFolder(win) {
    if (!win) return;
    System.promptSheet({
      parent:win,
      title:'前往文件夹',
      message:'输入要前往的文件夹路径：',
      value:displayPath(win._path || '/用户/roll'),
      placeholder:'/Users/roll/文稿',
      okLabel:'前往',
      validate:(value) => {
        const path = normalizeEnteredPath(value);
        return VFS.isDir(path) || '找不到该文件夹。请检查名称并再试一次。';
      },
      onOK:(value) => {
        openPath(win, normalizeEnteredPath(value));
        return true;
      },
    });
  }

  function normalizeEnteredPath(value) {
    let path = String(value || '').trim();
    if (path === '~' || path.startsWith('~/')) path = `/用户/roll${path.slice(1)}`;
    path = path
      .replace(/^\/Users(?=\/|$)/i, '/用户')
      .replace(/^\/Applications(?=\/|$)/i, '/应用程序')
      .replace(/^\/Library(?=\/|$)/i, '/资料库')
      .replace(/^\/System(?=\/|$)/i, '/系统');
    return VFS.normalize(path || '/');
  }

  function connectToServer(win) {
    if (!win) return;
    const recent = connectedServers();
    const content = el('div', 'finder-connect-server');
    const copy = el('div', 'finder-connect-copy');
    copy.innerHTML = `<div class="finder-connect-icon">${ICONS.folder}</div>
      <div><h3>连接服务器</h3><p>输入服务器地址，例如 smb://server/share 或 afp://server/share。</p></div>`;
    const label = el('label', 'finder-server-address');
    label.append(document.createTextNode('服务器地址：'));
    const input = el('input', 'aqua-input');
    input.value = recent[0]?.url || 'smb://Leopard-Web.local/公共';
    label.appendChild(input);
    const error = el('div', 'aqua-sheet-error');
    content.append(copy, label, error);
    if (recent.length) {
      const recentWrap = el('div', 'finder-recent-servers');
      recentWrap.appendChild(el('strong', '', '最近使用的服务器'));
      recent.forEach((entry) => {
        const button = el('button', '', `${ICONS.folder}<span><b>${esc(entry.name)}</b><small>${esc(entry.url)}</small></span>`);
        button.addEventListener('click', () => { input.value = entry.url; input.focus(); input.select(); });
        recentWrap.appendChild(button);
      });
      content.appendChild(recentWrap);
    }
    const connect = () => {
      const address = input.value.trim();
      let parsed;
      try { parsed = new URL(address); } catch (e) {}
      if (!parsed || !['smb:','afp:','ftp:','http:','https:'].includes(parsed.protocol) || !parsed.hostname) {
        error.textContent = '请输入包含协议与主机名的有效服务器地址。';
        input.focus(); input.select();
        return false;
      }
      const share = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) || '共享');
      const host = parsed.hostname.replace(/\.local$/i, '');
      const name = `${host} — ${share}`.replace(/[/:]/g, '-').slice(0, 60);
      const mountPath = VFS.normalize(`/用户/roll/公共/${name}`);
      if (!VFS.isDir(mountPath) && !VFS.mkdir(mountPath)) {
        error.textContent = '无法装载该服务器。';
        return false;
      }
      const welcome = `${mountPath}/关于此共享.txt`;
      if (!VFS.get(welcome)) {
        VFS.writeFile(welcome,
          `已连接到 ${address}\n\n浏览器无法直接装载 SMB/AFP 卷，因此此处以 Leopard 虚拟共享卷呈现。`);
      }
      saveConnectedServers([
        { url:address, name, path:mountPath, at:Date.now() },
        ...recent.filter((entry) => entry.url !== address),
      ]);
      openPath(win, mountPath, true, `server:${address}`);
      Leopard.toast('Finder', `已连接到“${name}”。`);
      return true;
    };
    System.showSheet({
      parent:win, title:'连接服务器', content, className:'finder-connect-server-sheet', initialFocus:input,
      buttons:[
        { label:'取消', cancel:true },
        { label:'连接', default:true, action:connect },
      ],
    });
    requestAnimationFrame(() => input.select());
  }

  function renameSelection(win) {
    const paths = selectedPaths(win);
    if (paths.length !== 1) return;
    const path = paths[0];
    const node = VFS.get(path);
    if (!node || node.type === 'app' || node.type === 'kext') {
      if (win?._status) win._status.textContent = '这个系统项目不能重新命名。';
      return;
    }
    const oldName = VFS.baseName(path);
    const item = [...win._main.querySelectorAll('[data-path]')].find((candidate) => candidate.dataset.path === path);
    const label = item?.querySelector('.fi-label, :scope > span:first-child > b, :scope > b');
    if (!item || !label) return;
    if (win._renaming) win._renaming.cancel();
    const input = el('input', 'finder-inline-rename');
    input.value = oldName;
    const original = label.textContent;
    label.textContent = '';
    label.appendChild(input);
    item.classList.add('renaming');
    let settled = false;
    let confirmingExtension = false;
    const commitRename = (nextName) => {
      const renamed = VFS.rename(path, nextName);
      if (!renamed) {
        input.disabled = false;
        input.classList.add('invalid');
        win._status.textContent = '无法重新命名这个项目。';
        input.focus();
        return false;
      }
      settled = true;
      win._finderSelection = new Set([renamed]);
      win._finderSelected = renamed;
      win._finderAnchor = renamed;
      win._renaming = null;
      render(win);
      return true;
    };
    const finish = (commit) => {
      if (settled || confirmingExtension) return;
      const nextName = input.value.trim();
      if (commit && nextName !== oldName) {
        if (!nextName || nextName.includes('/') || nextName === '.' || nextName === '..'
            || VFS.get(`${VFS.parentOf(path)}/${nextName}`)) {
          input.classList.add('invalid');
          input.setAttribute('aria-invalid', 'true');
          win._status.textContent = '这个名称不可用，或已有同名项目。';
          input.focus();
          input.select();
          return;
        }
        const oldExtension = extensionOf(oldName);
        const nextExtension = extensionOf(nextName);
        if (node.type === 'file' && finderPrefs().warnExtensionChange
            && oldExtension !== nextExtension) {
          confirmingExtension = true;
          input.disabled = true;
          System.confirmSheet({
            parent:win,
            headline:'确定要更改扩展名吗？',
            message:`如果将扩展名从“${oldExtension || '无'}”更改为“${nextExtension || '无'}”，文稿可能会由其他应用程序打开。`,
            cancelLabel:'保留原扩展名',
            okLabel:nextExtension ? `使用 .${nextExtension}` : '移除扩展名',
            onOK:() => {
              confirmingExtension = false;
              input.disabled = false;
              return commitRename(nextName);
            },
            onClose:(reason) => {
              if (reason !== 'cancel' || settled) return;
              confirmingExtension = false;
              input.disabled = false;
              requestAnimationFrame(() => { input.focus(); input.select(); });
            },
          });
          return;
        }
        return commitRename(nextName);
      }
      settled = true;
      label.textContent = original;
      item.classList.remove('renaming');
      win._renaming = null;
      win._main.focus({ preventScroll:true });
    };
    win._renaming = { cancel:() => finish(false) };
    ['mousedown','click','dblclick','contextmenu'].forEach((type) =>
      input.addEventListener(type, (event) => event.stopPropagation()));
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') { event.preventDefault(); finish(true); }
      else if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
    input.addEventListener('input', () => {
      input.classList.remove('invalid');
      input.removeAttribute('aria-invalid');
    });
    input.addEventListener('blur', () => setTimeout(() => finish(true), 0));
    requestAnimationFrame(() => { input.focus(); input.select(); });
  }

  function copySelection(win, operation = 'copy') {
    const paths = selectedPaths(win);
    if (!paths.length) return;
    clipboard = { operation, paths };
    if (win._status) win._status.textContent = `${operation === 'cut' ? '已剪切' : '已拷贝'} ${paths.length} 项`;
  }

  function runPaste(win, conflict) {
    if (!win || !clipboard.paths.length || !VFS.isDir(win._path)) return;
    const sourcePaths = clipboard.paths.slice();
    const next = [];
    const operation = clipboard.operation;
    const verb = operation === 'cut' ? '移动' : '拷贝';
    VFS.transaction(`${verb} ${sourcePaths.length} 个项目`, () => {
      sourcePaths.forEach((path) => {
        if (!VFS.get(path)) return;
        const options = { conflict, label:`${verb}“${VFS.baseName(path)}”` };
        const result = operation === 'cut' ? VFS.move(path, win._path, options) : VFS.copy(path, win._path, options);
        if (result) next.push(result);
      });
    }, { paths:sourcePaths });
    if (operation === 'cut' && next.length) {
      clipboard = { operation:null, paths:[] };
    }
    win._finderSelection = new Set(next);
    win._finderSelected = next[0] || null;
    win._finderAnchor = next[0] || null;
    render(win);
  }

  function pasteInto(win) {
    if (!win || !clipboard.paths.length || !VFS.isDir(win._path)) return;
    const collisions = clipboard.paths.filter((path) => {
      if (!VFS.get(path)) return false;
      const target = VFS.normalize(`${win._path}/${VFS.baseName(path)}`);
      return target !== VFS.normalize(path) && !!VFS.get(target);
    });
    if (!collisions.length) return runPaste(win);
    const body = el('div', 'finder-conflict-sheet');
    const iconWrap = el('div', 'finder-conflict-icon');
    iconWrap.innerHTML = nodeIcon(collisions[0]);
    const copy = el('div');
    const headline = el('h3', '', collisions.length === 1
      ? `“${VFS.baseName(collisions[0])}”已存在。`
      : `有 ${collisions.length} 个同名项目。`);
    const message = el('p', '', '您要替换目的位置中的项目，还是保留两个版本？');
    copy.append(headline, message);
    body.append(iconWrap, copy);
    System.showSheet({
      parent:win, title:'拷贝项目', content:body, className:'finder-conflict-panel',
      buttons:[
        { label:'取消', cancel:true },
        { label:'保留两个', action:() => runPaste(win) },
        { label:'替换', default:true, danger:true, action:() => runPaste(win, 'replace') },
      ],
    });
  }

  function trashSelection(win) {
    const paths = selectedPaths(win);
    if (!paths.length) return;
    const label = paths.length === 1 ? `将“${VFS.baseName(paths[0])}”移到废纸篓` : `将 ${paths.length} 个项目移到废纸篓`;
    VFS.transaction(label, () => paths.forEach((path) => System.moveToTrash(path)), { paths });
    clearSelection(win);
  }

  function permanentlyDeleteSelection(win) {
    const paths = selectedPaths(win);
    if (!paths.length) return;
    const label = paths.length === 1 ? `“${VFS.baseName(paths[0])}”` : `这 ${paths.length} 个项目`;
    System.confirmSheet({
      parent: win, title: '立即删除', headline: `确定永久删除${label}吗？`,
      message: '此操作无法撤销。', okLabel: '删除', danger: true,
      onOK: () => VFS.transaction('永久删除项目',
        () => paths.forEach((path) => VFS.remove(path, { record:false })),
        { paths, record:false }),
    });
  }

  function openItem(win, path) {
    const node = VFS.get(path);
    if (!node) return;
    if (node.kind === 'alias' && node.target && VFS.get(node.target)) {
      return openItem(win, node.target);
    }
    if (node.type === 'dir') {
      if (finderPrefs().openFoldersNewWindow) {
        System.launch('finder', { path, forceNew:true });
        return;
      }
      return openPath(win, path);
    }
    if (node.type === 'app') return System.launch(node.appId);
    System.openVfsPath?.(path);
  }

  function restoreItem(path) {
    const node = VFS.get(path);
    if (!node) return;
    let dest = node.from ? VFS.parentOf(node.from) : '/用户/roll/文稿';
    if (!VFS.isDir(dest)) dest = '/用户/roll/文稿';
    VFS.move(path, dest, {
      sourcePatch:{ from:null },
      label:`放回“${VFS.baseName(path)}”`,
    });
  }

  function getInfo(path) {
    const node = VFS.get(path);
    if (!node) return;
    const name = VFS.baseName(path);
    const c = el('div', 'finder-info');
    const childCount = node.type === 'dir' ? VFS.walk(path).length - 1 : 0;
    const size = node.type === 'dir'
      ? `${formatBytes(VFS.sizeOf(path))}（${childCount} 个项目）`
      : formatBytes(VFS.sizeOf(path));
    c.innerHTML = `<div class="finder-info-icon">${nodeIcon(path)}</div>
      <h2>${esc(name)}</h2>
      <section><b>种类：</b><span>${kindName(node)}</span>
      <b>大小：</b><span>${size}</span>
      <b>位置：</b><span>${esc(displayPath(VFS.parentOf(path)))}</span>
      <b>创建时间：</b><span>${formatDate(node.createdAt, true)}</span>
      <b>修改时间：</b><span>${formatDate(node.modifiedAt, true)}</span></section>
      <details open><summary>名称与扩展名</summary><input class="aqua-input" value="${esc(name)}"></details>
      <details><summary>共享与权限</summary><p>roll：读与写<br>staff：只读<br>everyone：只读</p></details>`;
    const input = c.querySelector('input');
    input.disabled = node.type === 'app' || node.type === 'kext';
    input.addEventListener('change', () => {
      const renamed = VFS.rename(path, input.value);
      if (!renamed) { input.value = name; System.alertBox('Finder', '无法使用这个名称。'); }
    });
    System.createWindow({
      app:'finder', title:`${name} 简介`, width:390, height:500,
      content:c, bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:360, maxHeight:560 },
    });
  }

  function labelMenuFor(paths) {
    const candidates = paths.filter((path) => VFS.get(path));
    const setLabels = (label) => VFS.transaction(label ? '设定 Finder 标签' : '清除 Finder 标签', () =>
      candidates.forEach((path) => VFS.updateNode(path, { label }, label ? '设定标签' : '清除标签')), { paths:candidates });
    return {
      label:'标签',
      disabled:!candidates.length,
      submenu:[
        ...finderPrefs().labels.map((entry) => ({
          label:entry.name,
          swatch:entry.id,
          checked:candidates.length > 0 && candidates.every((path) => VFS.get(path)?.label === entry.id),
          action:() => setLabels(entry.id),
        })),
        { sep:true },
        {
          label:'无',
          checked:candidates.length > 0 && candidates.every((path) => !VFS.get(path)?.label),
          action:() => setLabels(null),
        },
      ],
    };
  }

  function itemMenu(win, path, event) {
    const node = VFS.get(path);
    if (!node) return;
    if (!selectedPaths(win).includes(path)) setSelected(win, path);
    const paths = selectedPaths(win);
    const inTrash = win._path === System.TRASH || win._path.startsWith(System.TRASH + '/');
    const items = [
      { label: paths.length > 1 ? `打开 ${paths.length} 个项目` : '打开', action: () => paths.forEach((p) => openItem(win, p)) },
      { label: '快速查看', shortcut: 'Space', action: () => Leopard.quickLook(selectedPath(win)) },
      { sep: true },
      { label: paths.length > 1 ? `显示 ${paths.length} 项简介` : '显示简介', shortcut: '⌘I', action: () => paths.forEach(getInfo) },
    ];
    if (paths.every((p) => System.canDownloadVfsFile(p))) {
      items.push({ label: paths.length > 1 ? '下载到本地…' : '下载到本地…', action: () => paths.forEach(System.downloadVfsFile) });
    }
    if (paths.length === 1 && node.type !== 'app') {
      items.push(
        { label: '重新命名…', action: () => renameSelection(win) },
        { label: '制作替身', action: () => makeAliases(win) },
        { label: '复制', shortcut: '⌘D', action: () => duplicateSelection(win) },
      );
    }
    if (inTrash) {
      items.push({ sep: true },
        { label: '放回原处', action: () => paths.forEach(restoreItem) },
        { label: '立即删除…', action: () => permanentlyDeleteSelection(win) });
    } else if (paths.every((p) => ['file','dir'].includes(VFS.get(p)?.type))) {
      items.push({ sep: true }, { label: '移到废纸篓', shortcut: '⌘⌫', action: () => trashSelection(win) });
    }
    items.push({ sep:true }, labelMenuFor(paths));
    System.contextMenu(event, items);
  }

  function fileRows(win) {
    const query = win._finderQuery.trim().toLowerCase();
    let paths;
    if (win._smartSearch) {
      const prefs = finderPrefs();
      const scope = win._smartMode === 'query'
        ? (prefs.searchScope === 'current' ? win._searchBase || win._path
          : prefs.searchScope === 'previous' ? win._previousSearchRoot || win._searchBase || '/用户/roll'
          : '/')
        : '/用户/roll';
      win._previousSearchRoot = scope;
      paths = VFS.walk(scope).filter((p) => p !== scope && !p.includes('/.废纸篓')
        && !VFS.baseName(p).startsWith('.') && !VFS.get(p)?.hidden);
      if (win._smartMode === 'today') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        paths = paths.filter((path) => (VFS.get(path)?.modifiedAt || 0) >= start.getTime());
      } else if (win._smartMode === 'yesterday') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        paths = paths.filter((path) => {
          const modified = VFS.get(path)?.modifiedAt || 0;
          return modified >= yesterday.getTime() && modified < today.getTime();
        });
      } else if (win._smartMode === 'week') {
        const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
        paths = paths.filter((path) => (VFS.get(path)?.modifiedAt || 0) >= threshold);
      } else if (win._smartMode === 'images') {
        paths = paths.filter((path) => VFS.get(path)?.type === 'file' && isImageNode(path));
      } else if (win._smartMode === 'movies') {
        paths = paths.filter((path) => VFS.get(path)?.type === 'file' && isMovieNode(path));
      } else if (win._smartMode === 'documents' || win._smartMode === 'all') {
        paths = paths.filter((path) => VFS.get(path)?.type === 'file'
          && !isImageNode(path) && !isMovieNode(path)
          && !String(VFS.get(path)?.mime || '').startsWith('audio/'));
      }
    } else {
      paths = (VFS.list(win._path) || [])
        .filter((name) => !name.startsWith('.') && !VFS.get(VFS.normalize(`${win._path}/${name}`))?.hidden)
        .map((name) => VFS.normalize(win._path + '/' + name));
    }
    if (query) paths = paths.filter((path) => {
      const node = VFS.get(path);
      return VFS.baseName(path).toLowerCase().includes(query)
        || (node?.type === 'file' && String(node.content || '').toLowerCase().includes(query));
    });
    const sort = win._sort || 'name';
    return paths.sort((a,b) => {
      const an = VFS.get(a), bn = VFS.get(b);
      if (sort === 'kind') return String(an?.type).localeCompare(String(bn?.type)) || VFS.baseName(a).localeCompare(VFS.baseName(b),'zh-CN');
      if (sort === 'size') return VFS.sizeOf(b) - VFS.sizeOf(a);
      return VFS.baseName(a).localeCompare(VFS.baseName(b), 'zh-CN');
    });
  }

  function bindItem(win, item, path) {
    item.dataset.path = path;
    const node = VFS.get(path);
    if (node?.type === 'dir') item.dataset.dir = '1';
    if (node?.label) item.dataset.label = node.label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const mode = e.shiftKey ? 'range' : (e.metaKey || e.ctrlKey) ? 'toggle' : 'replace';
      setSelected(win, path, item, mode);
      win._main.focus({ preventScroll:true });
    });
    item.addEventListener('dblclick', (e) => { e.stopPropagation(); openItem(win, path); });
    item.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.shiftKey || e.metaKey || e.ctrlKey) return;
      if (!selectedPaths(win).includes(path)) setSelected(win, path, item);
      const paths = selectedPaths(win);
      System.startItemDrag(e, path, nodeIcon(path), paths.length > 1 ? `${paths.length} 个项目` : VFS.baseName(path), paths);
    });
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!selectedPaths(win).includes(path)) setSelected(win, path, item);
      itemMenu(win, path, e);
    });
  }

  function renderIcons(win, paths) {
    const options = folderViewOptions(win._path);
    const grid = el('div', 'finder-grid finder-icons-view');
    paths.forEach((path) => {
      const node = VFS.get(path);
      const item = el('div', 'f-icon');
      const iconMarkup = options.showIconPreview === false && isImageNode(path, node) ? ICONS.textfile : nodeIcon(path);
      const itemInfo = node?.type === 'dir'
        ? `${(VFS.list(path) || []).length} 个项目`
        : formatBytes(VFS.sizeOf(path));
      item.innerHTML = `<div class="fi-img">${iconMarkup}</div><div class="fi-copy"><div class="fi-label">${esc(displayName(path))}</div><div class="fi-info">${esc(itemInfo)}</div></div>`;
      bindItem(win, item, path);
      grid.appendChild(item);
    });
    win._main.appendChild(grid);
  }

  function renderList(win, paths) {
    const table = el('div', 'finder-list');
    table.innerHTML = '<div class="finder-list-head"><span>名称</span><span>修改日期</span><span>大小</span><span>种类</span></div>';
    paths.forEach((path) => {
      const node = VFS.get(path);
      const row = el('div', 'finder-list-row');
      const size = node.type === 'dir' ? '—' : formatBytes(VFS.sizeOf(path));
      row.innerHTML = `<span>${nodeIcon(path)}<b>${esc(displayName(path))}</b></span><span>${formatDate(node.modifiedAt)}</span><span>${size}</span><span>${kindName(node)}</span>`;
      bindItem(win, row, path);
      table.appendChild(row);
    });
    win._main.appendChild(table);
  }

  function renderColumns(win, paths) {
    const columns = el('div', 'finder-columns');
    const removeAfter = (depth) => {
      [...columns.children].slice(depth + 1).forEach((column) => column.remove());
    };
    const appendPreview = (path, depth) => {
      removeAfter(depth);
      const node = VFS.get(path);
      const preview = el('div', 'finder-column column-preview');
      const body = node?.type === 'file' && node.kind !== 'image'
        ? esc(String(node.content || '').slice(0, 700))
        : `${kindName(node)}<br>${formatBytes(VFS.sizeOf(path))}<br>${formatDate(node?.modifiedAt, true)}`;
      preview.dataset.previewPath = path;
      preview.innerHTML = `<div>${nodeIcon(path)}</div><h3>${esc(VFS.baseName(path))}</h3><p>${body}</p>`;
      columns.appendChild(preview);
    };
    const appendColumn = (parentPath, depth) => {
      removeAfter(depth - 1);
      const column = el('div', 'finder-column');
      column.dataset.parentPath = parentPath;
      const childPaths = (depth === 0 && win._smartSearch ? paths.slice() : (VFS.list(parentPath) || [])
        .filter((name) => !name.startsWith('.'))
        .map((name) => VFS.normalize(`${parentPath}/${name}`)))
        .sort((a, b) => {
          const ad = VFS.isDir(a), bd = VFS.isDir(b);
          return ad === bd ? VFS.baseName(a).localeCompare(VFS.baseName(b), 'zh-CN') : ad ? -1 : 1;
        });
      if (!childPaths.length) column.appendChild(el('p', 'column-empty', '此文件夹为空'));
      childPaths.forEach((path) => {
        const node = VFS.get(path);
        const item = el('div', 'column-item');
        item.innerHTML = `<span>${nodeIcon(path)}</span><b>${esc(displayName(path))}</b>${node.type === 'dir' ? '<i>▶</i>' : ''}`;
        bindItem(win, item, path);
        item.addEventListener('click', () => {
          win._columnTrail = (win._columnTrail || []).slice(0, depth);
          if (node.type === 'dir') {
            win._columnTrail[depth] = path;
            appendColumn(path, depth + 1);
          } else {
            appendPreview(path, depth);
          }
          requestAnimationFrame(() => { columns.scrollLeft = columns.scrollWidth; });
        });
        column.appendChild(item);
      });
      columns.appendChild(column);
    };
    appendColumn(win._path, 0);
    const trail = Array.isArray(win._columnTrail) ? win._columnTrail.slice() : [];
    win._columnTrail = [];
    let parentPath = win._path;
    trail.forEach((path, depth) => {
      if (VFS.parentOf(path) !== parentPath || !VFS.isDir(path)) return;
      win._columnTrail.push(path);
      appendColumn(path, depth + 1);
      parentPath = path;
    });
    win._main.appendChild(columns);
  }

  function renderCoverFlow(win, paths) {
    const view = el('div', 'finder-coverflow');
    const stage = el('div', 'cover-stage');
    const strip = el('div', 'cover-strip');
    const visible = paths.slice(0, 25);
    const selectCover = (path) => {
      setSelected(win, path);
      const idx = visible.indexOf(path);
      stage.innerHTML = '';
      visible.forEach((p, i) => {
        const card = el('button', 'cover-card' + (p === path ? ' active' : ''));
        const delta = i - idx;
        const bounded = Math.max(-5, Math.min(5, delta));
        const absolute = Math.abs(bounded);
        card.style.setProperty('--cover-x', `${bounded * 104}px`);
        card.style.setProperty('--cover-z', `${absolute * -60}px`);
        card.style.setProperty('--cover-rot', `${bounded * -48}deg`);
        card.style.setProperty('--cover-scale', String(1 - Math.min(absolute, 3) * .08));
        card.style.setProperty('--cover-opacity', String(1 - absolute * .13));
        card.innerHTML = `${nodeIcon(p)}<span>${esc(displayName(p))}</span>`;
        card.addEventListener('click', () => selectCover(p));
        card.addEventListener('dblclick', () => openItem(win,p));
        stage.appendChild(card);
      });
      strip.querySelectorAll('.cover-strip-item').forEach((r)=>r.classList.toggle('sel',r.dataset.path===path));
    };
    visible.forEach((path) => {
      const row = el('div','cover-strip-item');
      row.innerHTML = `${nodeIcon(path)}<b>${esc(displayName(path))}</b><span>${VFS.get(path)?.type === 'dir' ? '文件夹' : '文稿'}</span>`;
      bindItem(win,row,path);
      row.addEventListener('click',()=>selectCover(path));
      strip.appendChild(row);
    });
    view.append(stage,strip);
    win._main.appendChild(view);
    if (visible.length) selectCover(win._finderSelected && visible.includes(win._finderSelected) ? win._finderSelected : visible[0]);
  }

  function updatePreview(win) {
    if (!win._inspector) return;
    const path = selectedPath(win);
    if (!path) {
      win._inspector.innerHTML = '<p>选择一个项目以查看信息。</p>';
      return;
    }
    const node = VFS.get(path);
    win._inspector.innerHTML = `<div>${nodeIcon(path)}</div><b>${esc(VFS.baseName(path))}</b><small>${node?.type === 'dir'
      ? `${(VFS.list(path)||[]).length} 个项目，${formatBytes(VFS.sizeOf(path))}`
      : `${kindName(node)}，${formatBytes(VFS.sizeOf(path))}`}</small>`;
  }

  function render(win) {
    while (win._path !== '/' && !VFS.isDir(win._path)) win._path = VFS.parentOf(win._path);
    const viewOptions = folderViewOptions(win._path);
    if (win._appliedViewOptionsPath !== win._path) {
      if (viewOptions.alwaysView) win._view = viewOptions.alwaysView;
      win._sort = viewOptions.arrange;
      win._appliedViewOptionsPath = win._path;
    }
    win.style.setProperty('--finder-icon-size', `${viewOptions.iconSize}px`);
    win.style.setProperty('--finder-grid-gap', `${viewOptions.gridSpacing}px`);
    win.style.setProperty('--finder-text-size', `${viewOptions.textSize}px`);
    win.classList.toggle('finder-labels-right', viewOptions.labelPosition === 'right');
    win.classList.toggle('finder-show-item-info', !!viewOptions.showItemInfo);
    win._main.style.setProperty('--finder-folder-background',
      viewOptions.background === 'color' ? viewOptions.backgroundColor : '#fff');
    const paths = fileRows(win);
    if (!win._finderSelection) win._finderSelection = new Set();
    win._finderSelection = new Set([...win._finderSelection].filter((path) => {
      if (!VFS.get(path)) return false;
      if (win._view === 'columns') {
        return win._smartSearch ? paths.includes(path) : VFS.parentOf(path) === win._path || path.startsWith(`${win._path}/`);
      }
      return paths.includes(path);
    }));
    if (!win._finderSelection.has(win._finderSelected)) win._finderSelected = win._finderSelection.values().next().value || null;
    win._main.innerHTML = '';
    if (win._view === 'list') renderList(win, paths);
    else if (win._view === 'columns') renderColumns(win, paths);
    else if (win._view === 'cover') renderCoverFlow(win, paths);
    else renderIcons(win, paths);
    const smartTitles = {
      today:'今天', yesterday:'昨天', week:'过去一周', images:'所有图像',
      movies:'所有影片', documents:'所有文稿', all:'所有文稿',
    };
    const smartTitle = win._smartMode === 'query' ? `搜索“${win._finderQuery}”`
      : smartTitles[win._smartMode] || '搜索';
    win._pathLabel.textContent = win._smartSearch ? smartTitle : displayPath(win._path);
    win._title.textContent = win._smartSearch ? smartTitle : (win._path === '/' ? 'Macintosh HD' : VFS.baseName(win._path));
    win._status.textContent = `${paths.length} 项`;
    win._backBtn.disabled = !win._back.length;
    win._forwardBtn.disabled = !win._forward.length;
    win._upBtn.disabled = win._path === '/';
    win.querySelectorAll('.finder-view-btn').forEach((b)=>b.classList.toggle('active', b.dataset.view === win._view));
    win._side.querySelectorAll('.fs-item').forEach((item) => {
      const selected = win._sidebarRoute
        ? item.dataset.route === win._sidebarRoute
        : !win._smartSearch && item.dataset.path === win._path;
      item.classList.toggle('sel', selected);
    });
    refreshSelection(win);
  }

  function historyAction(win, direction) {
    const entry = direction === 'redo' ? VFS.redo() : VFS.undo();
    if (!entry) {
      if (win?._status) win._status.textContent = direction === 'redo' ? '没有可重做的文件操作。' : '没有可撤销的文件操作。';
      return;
    }
    const candidates = direction === 'redo' ? [...entry.paths].reverse() : entry.paths;
    const path = candidates.find((candidate) => VFS.get(candidate) && VFS.parentOf(candidate) === win?._path);
    if (path && win) {
      win._finderSelection = new Set([path]);
      win._finderSelected = path;
      win._finderAnchor = path;
    }
    if (win?._status) win._status.textContent = `${direction === 'redo' ? '已重做' : '已撤销'}：${entry.label}`;
  }

  function scrollSelectionIntoView(win) {
    const path = selectedPath(win);
    if (!path) return;
    const item = [...win._main.querySelectorAll('[data-path]')].find((candidate) => candidate.dataset.path === path);
    item?.scrollIntoView({ block:'nearest', inline:'nearest' });
  }

  function moveKeyboardSelection(win, key, extend) {
    if (win._view === 'columns' && !extend) {
      const currentPath = selectedPath(win);
      const currentItem = currentPath
        ? [...win._main.querySelectorAll('.column-item[data-path]')].find((item) => item.dataset.path === currentPath)
        : null;
      if (currentItem && key === 'ArrowRight' && VFS.isDir(currentPath)) {
        currentItem.click();
        const nextColumn = currentItem.closest('.finder-column')?.nextElementSibling;
        const firstChild = nextColumn?.querySelector('.column-item[data-path]');
        if (firstChild) {
          setSelected(win, firstChild.dataset.path);
          firstChild.scrollIntoView({ block:'nearest', inline:'nearest' });
        }
        return;
      }
      if (currentItem && key === 'ArrowLeft') {
        const parent = VFS.parentOf(currentPath);
        if (parent !== win._path) {
          const parentItem = [...win._main.querySelectorAll('.column-item[data-path]')].find((item) => item.dataset.path === parent);
          if (parentItem) {
            setSelected(win, parent);
            win._columnTrail = (win._columnTrail || []).filter((path) => path !== parent && !path.startsWith(`${parent}/`));
            [...parentItem.closest('.finder-column').parentElement.children]
              .slice([...parentItem.closest('.finder-column').parentElement.children].indexOf(parentItem.closest('.finder-column')) + 1)
              .forEach((column) => column.remove());
            parentItem.scrollIntoView({ block:'nearest', inline:'nearest' });
          }
        }
        return;
      }
    }
    const currentItem = selectedPath(win)
      ? [...win._main.querySelectorAll('[data-path]')].find((item) => item.dataset.path === selectedPath(win))
      : null;
    const paths = win._view === 'columns' && currentItem
      ? [...currentItem.closest('.finder-column').querySelectorAll('.column-item[data-path]')].map((item) => item.dataset.path)
      : fileRows(win);
    if (!paths.length) return;
    let index = paths.indexOf(selectedPath(win));
    if (index < 0) index = 0;
    let step = 0;
    if (key === 'ArrowLeft') step = -1;
    else if (key === 'ArrowRight') step = 1;
    else if (key === 'ArrowUp') {
      const columns = win._view === 'icons'
        ? Math.max(1, Math.floor(win._main.clientWidth / ((parseInt(getComputedStyle(win).getPropertyValue('--finder-icon-size'), 10) || 64) + 36)))
        : 1;
      step = -columns;
    } else if (key === 'ArrowDown') {
      const columns = win._view === 'icons'
        ? Math.max(1, Math.floor(win._main.clientWidth / ((parseInt(getComputedStyle(win).getPropertyValue('--finder-icon-size'), 10) || 64) + 36)))
        : 1;
      step = columns;
    }
    const next = paths[Math.max(0, Math.min(paths.length - 1, index + step))];
    if (next) {
      setSelected(win, next, null, extend ? 'range' : 'replace');
      scrollSelectionIntoView(win);
    }
  }

  function typeSelect(win, character) {
    clearTimeout(win._typeSelectTimer);
    win._typeSelectBuffer = `${win._typeSelectBuffer || ''}${character}`.toLocaleLowerCase('zh-CN');
    const currentItem = selectedPath(win)
      ? [...win._main.querySelectorAll('[data-path]')].find((item) => item.dataset.path === selectedPath(win))
      : null;
    const paths = win._view === 'columns' && currentItem
      ? [...currentItem.closest('.finder-column').querySelectorAll('.column-item[data-path]')].map((item) => item.dataset.path)
      : fileRows(win);
    const start = Math.max(0, paths.indexOf(selectedPath(win)) + 1);
    const ordered = paths.slice(start).concat(paths.slice(0, start));
    const match = ordered.find((path) => VFS.baseName(path).toLocaleLowerCase('zh-CN').startsWith(win._typeSelectBuffer));
    if (match) {
      setSelected(win, match);
      scrollSelectionIntoView(win);
    }
    win._typeSelectTimer = setTimeout(() => { win._typeSelectBuffer = ''; }, 850);
  }

  function handleFinderKeydown(win, event) {
    if (event.defaultPrevented || event.isComposing
        || event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowUp') {
        event.preventDefault();
        openPath(win, VFS.parentOf(win._path));
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowDown') {
        event.preventDefault();
        selectedPaths(win).forEach((path) => openItem(win, path));
        return;
      }
      event.preventDefault();
      moveKeyboardSelection(win, event.key, event.shiftKey);
    } else if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      renameSelection(win);
    } else if (event.key === 'Home') {
      event.preventDefault();
      const first = win._view === 'columns'
        ? win._main.querySelector('.finder-column:last-of-type .column-item[data-path]')?.dataset.path
        : fileRows(win)[0];
      if (first) { setSelected(win, first); scrollSelectionIntoView(win); }
    } else if (event.key === 'End') {
      event.preventDefault();
      const rows = win._view === 'columns'
        ? [...(win._main.querySelector('.finder-column:last-of-type')?.querySelectorAll('.column-item[data-path]') || [])].map((item) => item.dataset.path)
        : fileRows(win);
      const last = rows.at(-1);
      if (last) { setSelected(win, last); scrollSelectionIntoView(win); }
    } else if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1 && /\S/u.test(event.key)) {
      typeSelect(win, event.key);
    }
  }

  function startMarquee(win, event) {
    if (event.button !== 0 || win._view !== 'icons') return false;
    const grid = win._main.querySelector('.finder-icons-view');
    if (!grid || event.target.closest('[data-path]')) return false;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const additive = event.metaKey || event.ctrlKey;
    const base = additive ? new Set(selectedPaths(win)) : new Set();
    if (!additive) clearSelection(win);
    const box = el('div', 'finder-selection-box');
    win._main.appendChild(box);
    let frame = 0;
    let latest = event;
    const paint = () => {
      frame = 0;
      const mainRect = win._main.getBoundingClientRect();
      const left = Math.min(startX, latest.clientX);
      const top = Math.min(startY, latest.clientY);
      const right = Math.max(startX, latest.clientX);
      const bottom = Math.max(startY, latest.clientY);
      Object.assign(box.style, {
        left: `${left - mainRect.left + win._main.scrollLeft}px`,
        top: `${top - mainRect.top + win._main.scrollTop}px`,
        width: `${right - left}px`,
        height: `${bottom - top}px`,
      });
      const next = new Set(base);
      grid.querySelectorAll('.f-icon[data-path]').forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom) next.add(item.dataset.path);
      });
      win._finderSelection = next;
      win._finderSelected = next.values().next().value || null;
      refreshSelection(win);
    };
    const move = (nextEvent) => {
      latest = nextEvent;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const up = () => {
      removeEventListener('mousemove', move);
      removeEventListener('mouseup', up);
      if (frame) { cancelAnimationFrame(frame); paint(); }
      box.remove();
    };
    addEventListener('mousemove', move);
    addEventListener('mouseup', up);
    return true;
  }

  function makeSidebar(win) {
    const side = el('div','finder-side leopard-finder-side');
    const prefs = finderPrefs().sidebar;
    const servers = connectedServers();
    const groups = [
      ['设备', [
        { pref:'computer', route:'device:computer', path:'/', label:'roll 的 MacBook Pro', icon:ICONS.hd },
        { pref:'hardDisks', route:'device:hard-disk', path:'/', label:'Macintosh HD', icon:ICONS.hd },
      ]],
      ['共享', [
        { pref:'connectedServers', route:'shared:roll', path:'/用户/roll/公共', label:'roll 的 Mac', icon:ICONS.folder },
        { pref:'bonjour', route:'shared:bonjour', path:'/用户/roll/公共', label:'Bonjour', icon:ICONS.folder },
        ...servers.map((server) => ({
          pref:'connectedServers', route:`server:${server.url}`, path:server.path,
          label:server.name, icon:ICONS.folder, server,
        })),
      ]],
      ['位置', [
        { pref:'home', route:'place:home', path:'/用户/roll', label:'roll', icon:ICONS.folder },
        { pref:'desktop', route:'place:desktop', path:'/用户/roll/桌面', label:'桌面', icon:ICONS.folder },
        { pref:'applications', route:'place:applications', path:'/应用程序', label:'应用程序', icon:ICONS.folder },
        { pref:'documents', route:'place:documents', path:'/用户/roll/文稿', label:'文稿', icon:ICONS.folder },
        { pref:'downloads', route:'place:downloads', path:'/用户/roll/下载', label:'下载', icon:ICONS.folder },
        { pref:'movies', route:'place:movies', path:'/用户/roll/影片', label:'影片', icon:ICONS.folder },
        { pref:'pictures', route:'place:pictures', path:'/用户/roll/图片', label:'图片', icon:ICONS.folder },
        { pref:'music', route:'place:music', path:'/用户/roll/音乐', label:'音乐', icon:ICONS.folder },
      ]],
      ['搜索条件', [
        { pref:'today', route:'smart:today', smart:'today', label:'今天', icon:ICONS.textfile },
        { pref:'yesterday', route:'smart:yesterday', smart:'yesterday', label:'昨天', icon:ICONS.textfile },
        { pref:'pastWeek', route:'smart:week', smart:'week', label:'过去一周', icon:ICONS.textfile },
        { pref:'allImages', route:'smart:images', smart:'images', label:'所有图像', icon:ICONS.textfile },
        { pref:'allMovies', route:'smart:movies', smart:'movies', label:'所有影片', icon:ICONS.textfile },
        { pref:'allDocuments', route:'smart:documents', smart:'documents', label:'所有文稿', icon:ICONS.textfile },
      ]],
    ];
    groups.forEach(([title,items]) => {
      items = items.filter((item) => prefs[item.pref] !== false);
      if (!items.length) return;
      side.appendChild(el('div','fs-head',title));
      items.forEach((entry) => {
        const row = el('div','fs-item');
        row.dataset.route = entry.route;
        if (entry.path) row.dataset.path = entry.path;
        row.innerHTML = `${entry.icon}<span>${entry.label}</span>`;
        row.addEventListener('click',()=>{
          win._sidebarRoute = entry.route;
          if (entry.smart) {
            win._smartSearch = true;
            win._smartMode = entry.smart;
            win._finderQuery = '';
            if (win._search) win._search.value = '';
            render(win);
          } else {
            win._smartSearch = false;
            win._smartMode = '';
            if (win._search) win._search.value = '';
            openPath(win,entry.path,true,entry.route);
          }
        });
        if (entry.server) {
          row.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            System.contextMenu(event, [
              { label:'打开', action:() => openPath(win, entry.path, true, entry.route) },
              { label:'显示简介', action:() => getInfo(entry.path) },
              { sep:true },
              { label:'断开连接', action:() => {
                saveConnectedServers(connectedServers().filter((server) => server.url !== entry.server.url));
                if (win._path === entry.path || win._path.startsWith(`${entry.path}/`)) openPath(win, '/用户/roll/公共');
              }},
            ]);
          });
        }
        side.appendChild(row);
      });
    });
    return side;
  }

  function open(arg) {
    const preferredPath = finderPrefs().newWindowPath;
    const startPath = arg?.path && VFS.isDir(arg.path) ? arg.path
      : VFS.isDir(preferredPath) ? preferredPath : '/用户/roll';
    const layout = el('div','finder-layout leopard-finder-layout');
    const toolbar = el('div','finder-toolbar');
    const nav = el('div','finder-toolbar-group');
    const back = el('button','finder-toolbar-btn',toolGlyph('back'));
    const forward = el('button','finder-toolbar-btn',toolGlyph('forward'));
    const up = el('button','finder-toolbar-btn',toolGlyph('up'));
    back.title='后退'; forward.title='前进'; up.title='上层文件夹';
    nav.append(back,forward,up);
    const views = el('div','finder-toolbar-group finder-view-group');
    [['icons','图标'],['list','列表'],['columns','分栏'],['cover','Cover Flow']].forEach(([id,label])=>{
      const b=el('button','finder-toolbar-btn finder-view-btn',toolGlyph(id));
      b.dataset.view=id; b.title=label; b.setAttribute('aria-label',label); views.appendChild(b);
    });
    const quick = el('button','finder-toolbar-btn finder-quick-btn',`${toolGlyph('quick')}<span>快速查看</span>`);
    const action = el('button','finder-toolbar-btn finder-action-btn',toolGlyph('action'));
    action.title='操作'; action.setAttribute('aria-label','操作');
    const pathLabel = el('span','finder-path');
    const search = el('input','aqua-input aqua-search finder-search');
    search.placeholder='搜索';
    toolbar.append(nav,views,quick,action,pathLabel,search);
    const side = makeSidebar({});
    const main = el('div','finder-main');
    main.tabIndex = 0;
    main.setAttribute('role', 'listbox');
    main.setAttribute('aria-label', 'Finder 项目');
    const inspector = el('aside','finder-inspector');
    const content = el('div','finder-content');
    content.append(main,inspector);
    layout.append(side,content);
    let onVfs;
    const win = System.createWindow({
      app:'finder', title:'Finder', width:820, height:520, toolbar, content:layout, statusbar:'',
      onClose:()=>{
        if(onVfs)document.removeEventListener('vfs-changed',onVfs);
        clearTimeout(win._typeSelectTimer);
        openWindows.delete(win);
      },
    });
    // The sidebar needs the final window reference for its handlers.
    side.replaceWith(makeSidebar(win));
    win._side=layout.querySelector('.finder-side');
    win._main=main; win._inspector=inspector; win._pathLabel=pathLabel; win._search=search;
    win._backBtn=back; win._forwardBtn=forward; win._upBtn=up;
    win._path=startPath; win._back=[]; win._forward=[]; win._finderQuery='';
    win._finderSelection=new Set(); win._finderSelected=null; win._finderAnchor=null;
    win._smartSearch=false; win._smartMode=''; win._sidebarRoute=''; win._searchBase=startPath;
    win._view=localStorage.getItem(VIEW_KEY)||'icons'; win._sort='name';
    win._typeSelectBuffer=''; win._renaming=null;
    openWindows.add(win);

    back.addEventListener('click',()=>{const p=win._back.pop();if(p){win._forward.push(win._path);win._path=p;win._sidebarRoute='';render(win);}});
    forward.addEventListener('click',()=>{const p=win._forward.pop();if(p){win._back.push(win._path);win._path=p;win._sidebarRoute='';render(win);}});
    up.addEventListener('click',()=>openPath(win,VFS.parentOf(win._path)));
    views.addEventListener('click',(e)=>{
      const b=e.target.closest('[data-view]');if(!b)return;
      win._view=b.dataset.view;localStorage.setItem(VIEW_KEY,win._view);render(win);
    });
    quick.addEventListener('click',()=>selectedPath(win)?Leopard.quickLook(selectedPath(win)):System.alertBox('快速查看','请先选择一个项目。'));
    action.addEventListener('click',(e)=>{
      const p=selectedPath(win);
      const inTrash = win._path === System.TRASH || win._path.startsWith(`${System.TRASH}/`);
      System.contextMenu(e,p?[
        {label:selectedPaths(win).length > 1 ? `打开 ${selectedPaths(win).length} 个项目` : '打开',action:()=>selectedPaths(win).forEach((path)=>openItem(win,path))},
        {label:'快速查看',action:()=>Leopard.quickLook(p)},
        {label:'显示简介',action:()=>selectedPaths(win).forEach(getInfo)},
        ...(selectedPaths(win).every(System.canDownloadVfsFile)?[{label:'下载到本地…',action:()=>selectedPaths(win).forEach(System.downloadVfsFile)}]:[]),
        {sep:true},
        {label:'重新命名…',disabled:selectedPaths(win).length!==1,action:()=>renameSelection(win)},
        ...(inTrash ? [
          {label:'放回原处',action:()=>selectedPaths(win).forEach(restoreItem)},
          {label:'立即删除…',action:()=>permanentlyDeleteSelection(win)},
        ] : [{label:'移到废纸篓',action:()=>trashSelection(win)}]),
        labelMenuFor(selectedPaths(win)),
        {sep:true},{label:'新建文件夹',action:()=>createFolder(win)},
      ]:[
        {label:'新建文件夹',action:()=>createFolder(win)},
        {label:'排列方式：名称',action:()=>{win._sort='name';render(win);}},
        {label:'排列方式：种类',action:()=>{win._sort='kind';render(win);}},
        {label:'排列方式：大小',action:()=>{win._sort='size';render(win);}},
      ]);
    });
    search.addEventListener('input',()=>{
      if (!win._smartSearch && search.value) win._searchBase = win._path;
      win._finderQuery=search.value;
      win._smartSearch=!!search.value;
      win._smartMode=search.value ? 'query' : '';
      win._sidebarRoute='';
      render(win);
    });
    main.addEventListener('keydown',(event)=>handleFinderKeydown(win,event));
    main.addEventListener('mousedown',(e)=>{
      if (e.target.closest('[data-path]')) return;
      if (startMarquee(win, e)) return;
      if(e.target===main||e.target.closest('.finder-grid,.finder-list,.finder-columns,.cover-strip')) {
        clearSelection(win);
      }
    });
    main.addEventListener('contextmenu',(e)=>{
      if(e.target.closest('[data-path]'))return;e.preventDefault();
      System.contextMenu(e,[
        {label:'新建文件夹',action:()=>createFolder(win)},
        {label:'粘贴项目',disabled:!clipboard.paths.length,action:()=>pasteInto(win)},
        {label:'显示查看选项',action:()=>showViewOptions(win)},
      ]);
    });
    win.addEventListener('leopard-command',(event)=>{
      const command=event.detail?.command;
      if(!command)return;
      const handled={
        'new-folder':()=>createFolder(win),
        'open':()=>selectedPaths(win).forEach((path)=>openItem(win,path)),
        'quick-look':()=>selectedPath(win)&&Leopard.quickLook(selectedPath(win)),
        'get-info':()=>selectedPaths(win).forEach(getInfo),
        'rename':()=>renameSelection(win),
        'duplicate':()=>duplicateSelection(win),
        'make-alias':()=>makeAliases(win),
        'cut':()=>copySelection(win,'cut'),
        'copy':()=>copySelection(win,'copy'),
        'paste':()=>pasteInto(win),
        'delete':()=>trashSelection(win),
        'undo':()=>historyAction(win,'undo'),
        'redo':()=>historyAction(win,'redo'),
        'preferences':()=>showPreferences(),
        'go-to-folder':()=>goToFolder(win),
        'connect-server':()=>connectToServer(win),
        'go-desktop':()=>openPath(win,'/用户/roll/桌面'),
        'go-documents':()=>openPath(win,'/用户/roll/文稿'),
        'go-downloads':()=>openPath(win,'/用户/roll/下载'),
        'view-icons':()=>{win._view='icons';localStorage.setItem(VIEW_KEY,'icons');render(win);},
        'view-list':()=>{win._view='list';localStorage.setItem(VIEW_KEY,'list');render(win);},
        'view-columns':()=>{win._view='columns';localStorage.setItem(VIEW_KEY,'columns');render(win);},
        'view-cover':()=>{win._view='cover';localStorage.setItem(VIEW_KEY,'cover');render(win);},
        'view-options':()=>showViewOptions(win),
        'selectAll':()=>{win._finderSelection=new Set(fileRows(win));win._finderSelected=fileRows(win)[0]||null;refreshSelection(win);},
      }[command];
      if(handled){event.preventDefault();handled();}
    });
    onVfs=()=>render(win);document.addEventListener('vfs-changed',onVfs);
    render(win);
  }

  function showPreferences(initialPane = 'general') {
    if (preferencesWindow?.isConnected) {
      System.focusWindow(preferencesWindow);
      const requested = preferencesWindow.querySelector(`[data-pref-tab="${initialPane}"]`);
      requested?.click();
      return preferencesWindow;
    }
    const prefs = finderPrefs();
    const content = el('div', 'spp-pane finder-preferences');
    const tabs = el('nav', 'finder-pref-tabs');
    const tabDefs = [
      ['general','通用','<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#fff" stroke-width="1.3"/>'],
      ['labels','标签','<path d="M4 6h9l7 7-7 7-9-9z"/><circle cx="9" cy="10" r="1.7" fill="#fff"/>'],
      ['sidebar','边栏','<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M10 4v16M6.5 8h1M6.5 12h1M6.5 16h1" stroke="#fff" stroke-width="1.2"/>'],
      ['advanced','高级','<circle cx="12" cy="12" r="4"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" stroke="#fff" stroke-width="1.7"/>'],
    ];
    tabDefs.forEach(([id,label,paths]) => {
      const button = el('button','finder-pref-tab');
      button.type = 'button';
      button.dataset.prefTab = id;
      button.innerHTML = `<i><svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg></i><span>${label}</span>`;
      tabs.appendChild(button);
    });
    content.appendChild(tabs);

    const panels = el('div', 'finder-pref-panels');
    const general = el('section', 'finder-pref-panel');
    general.dataset.prefPanel = 'general';
    general.innerHTML = `
      <fieldset><legend>在桌面上显示这些项目：</legend>
        <div class="finder-pref-grid">
          <label><input type="checkbox" data-desktop="hardDisks"> 硬盘</label>
          <label><input type="checkbox" data-desktop="externalDisks"> 外置磁盘</label>
          <label><input type="checkbox" data-desktop="opticalDisks"> CD、DVD 和 iPod</label>
          <label><input type="checkbox" data-desktop="connectedServers"> 已连接的服务器</label>
        </div>
      </fieldset>
      <fieldset><legend>新 Finder 窗口显示：</legend>
        <select class="aqua-select" data-pref-value="newWindowPath">
          <option value="/用户/roll">roll</option>
          <option value="/用户/roll/桌面">桌面</option>
          <option value="/用户/roll/文稿">文稿</option>
          <option value="/应用程序">应用程序</option>
          <option value="/">Macintosh HD</option>
        </select>
      </fieldset>
      <fieldset class="finder-pref-behavior">
        <label><input type="checkbox" data-pref-value="openFoldersNewWindow"> 总是在新窗口中打开文件夹</label>
        <label><input type="checkbox" data-pref-value="springLoaded"> 弹簧式打开文件夹和窗口</label>
        <div class="finder-spring-delay">
          <span>延迟：</span><small>短</small><input type="range" min="0.12" max="1.4" step="0.04" data-pref-value="springDelay"><small>长</small>
        </div>
        <p>拖移项目时将指针停在文件夹上即可打开它。按空格键可立即打开。</p>
      </fieldset>`;

    const labels = el('section', 'finder-pref-panel finder-label-preferences');
    labels.dataset.prefPanel = 'labels';
    labels.innerHTML = `<h3>标签</h3><p>为标签输入便于识别的名称。它们会出现在 Finder 的操作菜单中。</p>
      <div class="finder-label-list">${prefs.labels.map((entry) => `
        <label><i data-label-color="${entry.id}"></i><input class="aqua-input" maxlength="40" data-label-name="${entry.id}" value="${esc(entry.name)}"></label>`).join('')}
      </div>`;

    const sidebar = el('section', 'finder-pref-panel finder-sidebar-preferences');
    sidebar.dataset.prefPanel = 'sidebar';
    const sideGroups = [
      ['设备', [['computer','电脑'],['hardDisks','硬盘'],['externalDisks','外置磁盘'],['opticalDisks','CD、DVD 和 iPod']]],
      ['共享', [['connectedServers','已连接的服务器'],['bonjour','Bonjour 电脑']]],
      ['位置', [['home','个人文件夹'],['desktop','桌面'],['applications','应用程序'],['documents','文稿'],['downloads','下载'],['movies','影片'],['pictures','图片'],['music','音乐']]],
      ['搜索条件', [['today','今天'],['yesterday','昨天'],['pastWeek','过去一周'],['allImages','所有图像'],['allMovies','所有影片'],['allDocuments','所有文稿']]],
    ];
    sidebar.innerHTML = sideGroups.map(([title,items]) => `<fieldset><legend>${title}</legend><div class="finder-pref-grid">
      ${items.map(([id,label]) => `<label><input type="checkbox" data-sidebar="${id}"> ${label}</label>`).join('')}
    </div></fieldset>`).join('');

    const advanced = el('section', 'finder-pref-panel finder-advanced-preferences');
    advanced.dataset.prefPanel = 'advanced';
    advanced.innerHTML = `
      <fieldset>
        <label><input type="checkbox" data-pref-value="showAllExtensions"> 显示所有文件扩展名</label>
        <label><input type="checkbox" data-pref-value="warnExtensionChange"> 更改扩展名之前显示警告</label>
        <label><input type="checkbox" data-pref-value="warnEmptyTrash"> 清倒废纸篓之前显示警告</label>
      </fieldset>
      <fieldset><legend>执行搜索时：</legend>
        <select class="aqua-select" data-pref-value="searchScope">
          <option value="mac">搜索这台 Mac</option>
          <option value="current">搜索当前文件夹</option>
          <option value="previous">使用上一次搜索范围</option>
        </select>
        <p>此选项决定 Finder 工具栏搜索框的默认搜索范围。</p>
      </fieldset>`;
    panels.append(general,labels,sidebar,advanced);
    content.appendChild(panels);

    const switchPane = (id) => {
      content.querySelectorAll('[data-pref-tab]').forEach((button) => {
        const selected = button.dataset.prefTab === id;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', String(selected));
      });
      content.querySelectorAll('[data-pref-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.prefPanel !== id;
      });
      if (preferencesWindow) preferencesWindow._title.textContent = `Finder 偏好设置 — ${tabDefs.find((entry) => entry[0] === id)?.[1] || '通用'}`;
      content.dispatchEvent(new CustomEvent('panel-layout-changed', { bubbles:true }));
    };
    tabs.addEventListener('click', (event) => {
      const button = event.target.closest('[data-pref-tab]');
      if (button) switchPane(button.dataset.prefTab);
    });

    content.querySelectorAll('[data-desktop]').forEach((input) => {
      input.checked = !!prefs.desktop[input.dataset.desktop];
      input.addEventListener('change', () =>
        System.updateFinderPreferences({ desktop:{ [input.dataset.desktop]:input.checked } }));
    });
    content.querySelectorAll('[data-sidebar]').forEach((input) => {
      input.checked = !!prefs.sidebar[input.dataset.sidebar];
      input.addEventListener('change', () =>
        System.updateFinderPreferences({ sidebar:{ [input.dataset.sidebar]:input.checked } }));
    });
    content.querySelectorAll('[data-pref-value]').forEach((control) => {
      const key = control.dataset.prefValue;
      if (control.type === 'checkbox') control.checked = !!prefs[key];
      else control.value = String(prefs[key]);
      const eventName = control.type === 'range' ? 'input' : 'change';
      control.addEventListener(eventName, () => {
        const value = control.type === 'checkbox' ? control.checked
          : control.type === 'range' ? Number(control.value) : control.value;
        System.updateFinderPreferences({ [key]:value });
        if (key === 'springDelay') {
          const valueText = general.querySelector('.finder-spring-value');
          if (valueText) valueText.textContent = `${Math.round(value * 1000)} 毫秒`;
        }
      });
    });
    content.querySelectorAll('[data-label-name]').forEach((input) => {
      input.addEventListener('change', () => {
        const current = finderPrefs().labels;
        const next = current.map((entry) => entry.id === input.dataset.labelName
          ? { id:entry.id, name:input.value.trim() || entry.name }
          : entry);
        input.value = next.find((entry) => entry.id === input.dataset.labelName)?.name || input.value;
        System.updateFinderPreferences({ labels:next });
      });
    });
    const springRow = general.querySelector('.finder-spring-delay');
    springRow?.appendChild(el('output','finder-spring-value',`${Math.round(prefs.springDelay * 1000)} 毫秒`));
    const springToggle = general.querySelector('[data-pref-value="springLoaded"]');
    const updateSpringState = () => {
      springRow?.classList.toggle('disabled', !springToggle.checked);
      springRow?.querySelectorAll('input').forEach((input) => { input.disabled = !springToggle.checked; });
    };
    springToggle.addEventListener('change', updateSpringState);
    updateSpringState();

    preferencesWindow = System.createWindow({
      app:'finder', title:'Finder 偏好设置 — 通用', width:560, height:500,
      content, bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:360, maxHeight:560 },
      onClose:() => { preferencesWindow = null; },
    });
    preferencesWindow.classList.add('finder-preferences-window');
    switchPane(tabDefs.some((entry) => entry[0] === initialPane) ? initialPane : 'general');
    return preferencesWindow;
  }

  function showViewOptions(win) {
    if (!win) return;
    if (viewOptionsWindow?.isConnected) System.closeWindow(viewOptionsWindow);
    let options = folderViewOptions(win._path);
    const c = el('div','finder-view-options');
    c.innerHTML = `<h2>${esc(win._path === '/' ? 'Macintosh HD' : VFS.baseName(win._path))}</h2>
      <label>排列方式
        <select class="aqua-select" data-view-option="arrange">
          <option value="name">名称</option><option value="kind">种类</option><option value="size">大小</option>
        </select>
      </label>
      <label class="finder-view-slider"><span>图标大小</span><small>小</small><input type="range" min="44" max="96" step="4" data-view-option="iconSize"><small>大</small><output></output></label>
      <label class="finder-view-slider"><span>网格间距</span><small>紧密</small><input type="range" min="2" max="28" step="2" data-view-option="gridSpacing"><small>宽松</small><output></output></label>
      <label>文字大小
        <select class="aqua-select" data-view-option="textSize">
          ${[9,10,11,12,13,14,16].map((size) => `<option value="${size}">${size} 点</option>`).join('')}
        </select>
      </label>
      <fieldset><legend>标签位置</legend>
        <label><input type="radio" name="finder-label-position" value="bottom"> 底部</label>
        <label><input type="radio" name="finder-label-position" value="right"> 右侧</label>
      </fieldset>
      <label class="finder-view-check"><input type="checkbox" data-view-option="showItemInfo"> 显示项目简介</label>
      <label class="finder-view-check"><input type="checkbox" data-view-option="showIconPreview"> 显示图标预览</label>
      <fieldset class="finder-view-background"><legend>背景</legend>
        <label><input type="radio" name="finder-background" value="white"> 白色</label>
        <label><input type="radio" name="finder-background" value="color"> 颜色</label>
        <input type="color" data-view-option="backgroundColor" aria-label="背景颜色">
      </fieldset>
      <label class="finder-view-check"><input type="checkbox" data-view-option="alwaysView"> 始终以${({icons:'图标',list:'列表',columns:'分栏',cover:'Cover Flow'})[win._view] || '当前'}方式打开</label>
      <footer><button class="aqua-btn finder-view-default">用作默认</button></footer>`;

    const persist = () => {
      writeFolderViewOptions(win._path, options);
      if (win.isConnected) {
        win._appliedViewOptionsPath = '';
        render(win);
      }
    };
    c.querySelector('[data-view-option="arrange"]').value = options.arrange;
    c.querySelector('[data-view-option="iconSize"]').value = String(options.iconSize);
    c.querySelector('[data-view-option="gridSpacing"]').value = String(options.gridSpacing);
    c.querySelector('[data-view-option="textSize"]').value = String(options.textSize);
    c.querySelector('[data-view-option="showItemInfo"]').checked = !!options.showItemInfo;
    c.querySelector('[data-view-option="showIconPreview"]').checked = options.showIconPreview !== false;
    c.querySelector('[data-view-option="backgroundColor"]').value = options.backgroundColor;
    c.querySelector(`[name="finder-label-position"][value="${options.labelPosition}"]`).checked = true;
    c.querySelector(`[name="finder-background"][value="${options.background}"]`).checked = true;
    c.querySelector('[data-view-option="alwaysView"]').checked = options.alwaysView === win._view;

    const refreshOutputs = () => {
      c.querySelector('[data-view-option="iconSize"]').closest('label').querySelector('output').textContent = `${options.iconSize}px`;
      c.querySelector('[data-view-option="gridSpacing"]').closest('label').querySelector('output').textContent = `${options.gridSpacing}px`;
      c.querySelector('[data-view-option="backgroundColor"]').disabled = options.background !== 'color';
    };
    c.querySelectorAll('[data-view-option]').forEach((control) => {
      const key = control.dataset.viewOption;
      const eventName = control.type === 'range' || control.type === 'color' ? 'input' : 'change';
      control.addEventListener(eventName, () => {
        if (key === 'alwaysView') options.alwaysView = control.checked ? win._view : '';
        else if (control.type === 'checkbox') options[key] = control.checked;
        else if (control.type === 'range' || key === 'textSize') options[key] = Number(control.value);
        else options[key] = control.value;
        refreshOutputs();
        persist();
      });
    });
    c.querySelectorAll('[name="finder-label-position"]').forEach((control) =>
      control.addEventListener('change', () => {
        if (!control.checked) return;
        options.labelPosition = control.value;
        persist();
      }));
    c.querySelectorAll('[name="finder-background"]').forEach((control) =>
      control.addEventListener('change', () => {
        if (!control.checked) return;
        options.background = control.value;
        refreshOutputs();
        persist();
      }));
    c.querySelector('.finder-view-default').addEventListener('click', () => {
      writeDefaultViewOptions(options);
      Leopard.toast('Finder', '这些查看选项将用于新的文件夹。');
    });
    refreshOutputs();
    const createdWindow = System.createWindow({
      app:'finder', title:'查看选项', width:370, height:455, content:c,
      bodyBg:'#ececec', noResize:true,
      autoFitContent:{ minHeight:360, maxHeight:520 },
      onClose:(closingWindow) => {
        if (viewOptionsWindow === closingWindow) viewOptionsWindow = null;
      },
    });
    viewOptionsWindow = createdWindow;
    return viewOptionsWindow;
  }

  const menus = () => {
    const top = frontFinderWindow();
    const inTrash = top?._path === System.TRASH || top?._path?.startsWith(`${System.TRASH}/`);
    const selection = selectedPaths(top);
    const hasSelection = selection.length > 0;
    const singleSelection = selection.length === 1;
    const canRename = singleSelection && !['app','kext'].includes(VFS.get(selection[0])?.type);
    const canTrash = hasSelection && selection.every((path) => ['file','dir'].includes(VFS.get(path)?.type));
    const canDownload = hasSelection && selection.every(System.canDownloadVfsFile);
    const currentView = top?._view || localStorage.getItem(VIEW_KEY) || 'icons';
    const finderWindows = [...openWindows].filter((win) => win.isConnected);
    return [
    { title:'文件', items:[
      {label:'新建 Finder 窗口',shortcut:'⌘N',action:()=>System.launch('finder',{forceNew:true})},
      {label:'新建文件夹',shortcut:'⇧⌘N',disabled:!top || !VFS.isDir(top._path),action:()=>createFolder(top)},
      {sep:true},{label:selection.length > 1 ? `打开 ${selection.length} 个项目` : '打开',shortcut:'⌘O',disabled:!hasSelection,action:()=>selection.forEach((path)=>openItem(top,path))},
      {label:'快速查看',shortcut:'Space',disabled:!hasSelection,action:()=>hasSelection&&Leopard.quickLook(selection[0])},
      {label:selection.length > 1 ? `显示 ${selection.length} 项简介` : '显示简介',shortcut:'⌘I',disabled:!hasSelection,action:()=>selection.forEach(getInfo)},
      ...(canDownload ? [{label:'下载到本地…',action:()=>selection.forEach(System.downloadVfsFile)}] : []),
      {sep:true},
      {label:'制作替身',shortcut:'⌘L',disabled:!hasSelection,action:()=>makeAliases(top)},
      {label:'复制',shortcut:'⌘D',disabled:!hasSelection,action:()=>duplicateSelection(top)},
      {label:'重新命名…',disabled:!canRename,action:()=>renameSelection(top)},
      ...(inTrash ? [
        {label:'放回原处',disabled:!hasSelection,action:()=>selection.forEach(restoreItem)},
        {label:'立即删除…',disabled:!hasSelection,action:()=>permanentlyDeleteSelection(top)},
      ] : [{label:'移到废纸篓',shortcut:'⌘⌫',disabled:!canTrash,action:()=>trashSelection(top)}]),
      {sep:true},{label:'关闭窗口',shortcut:'⌘W',action:()=>{const w=System.topWindowOf('finder');if(w)System.closeWindow(w);}},
    ]},
    { title:'编辑', items:[
      {label:VFS.canUndo() ? `撤销 ${VFS.undoLabel()}` : '撤销',shortcut:'⌘Z',disabled:!VFS.canUndo(),action:()=>historyAction(frontFinderWindow(),'undo')},
      {label:VFS.canRedo() ? `重做 ${VFS.redoLabel()}` : '重做',shortcut:'⇧⌘Z',disabled:!VFS.canRedo(),action:()=>historyAction(frontFinderWindow(),'redo')},
      {sep:true},
      {label:'剪切',shortcut:'⌘X',disabled:!hasSelection,action:()=>copySelection(top,'cut')},
      {label:'拷贝',shortcut:'⌘C',disabled:!hasSelection,action:()=>copySelection(top,'copy')},
      {label:'粘贴',shortcut:'⌘V',disabled:!top || !clipboard.paths.length,action:()=>pasteInto(top)},
      {label:'全选',shortcut:'⌘A',disabled:!top || !fileRows(top).length,action:()=>{if(top){const rows=fileRows(top);top._finderSelection=new Set(rows);top._finderSelected=rows[0]||null;refreshSelection(top);}}},
    ]},
    { title:'显示', items:[
      {label:'为图标',shortcut:'⌘1',checked:currentView==='icons',action:()=>setTopView('icons')},{label:'为列表',shortcut:'⌘2',checked:currentView==='list',action:()=>setTopView('list')},
      {label:'为分栏',shortcut:'⌘3',checked:currentView==='columns',action:()=>setTopView('columns')},{label:'为 Cover Flow',shortcut:'⌘4',checked:currentView==='cover',action:()=>setTopView('cover')},
      {sep:true},{label:'显示查看选项',shortcut:'⌘J',disabled:!top,action:()=>top&&showViewOptions(top)},
    ]},
    { title:'前往', items:[
      {label:'后退',shortcut:'⌘[',disabled:!top?._back?.length,action:()=>top?._backBtn.click()},
      {label:'前进',shortcut:'⌘]',disabled:!top?._forward?.length,action:()=>top?._forwardBtn.click()},
      {sep:true},{label:'电脑',shortcut:'⇧⌘C',action:()=>goTop('/')},{label:'个人',shortcut:'⇧⌘H',action:()=>goTop('/用户/roll')},
      {label:'桌面',shortcut:'⇧⌘D',action:()=>goTop('/用户/roll/桌面')},
      {label:'文稿',shortcut:'⇧⌘O',action:()=>goTop('/用户/roll/文稿')},
      {label:'下载',shortcut:'⌥⌘L',action:()=>goTop('/用户/roll/下载')},
      {label:'应用程序',shortcut:'⇧⌘A',action:()=>goTop('/应用程序')},{label:'实用工具',shortcut:'⇧⌘U',action:()=>goTop('/应用程序/实用工具')},
      {sep:true},
      {label:'前往文件夹…',shortcut:'⇧⌘G',disabled:!top,action:()=>goToFolder(top)},
      {label:'连接服务器…',shortcut:'⌘K',disabled:!top,action:()=>connectToServer(top)},
    ]},
    { title:'窗口', items:[
      {label:'最小化',shortcut:'⌘M',action:()=>{const w=System.topWindowOf('finder');if(w)System.minimizeWindow(w);}},
      {label:'缩放',action:()=>System.topWindowOf('finder')?.querySelector('.tl-zoom')?.click()},
      {sep:true},{label:'将所有窗口移到前面',action:()=>openWindows.forEach((w)=>System.focusWindow(w))},
      ...(finderWindows.length ? [
        {sep:true},
        ...finderWindows.map((win) => ({
          label:win._title?.textContent || 'Finder',
          checked:win === top,
          action:()=>{System.focusWindow(win);},
        })),
      ] : []),
    ]},
    { title:'帮助', items:[
      {label:'Finder 帮助',shortcut:'⌘?',action:()=>System.launch('helpviewer',{appId:'finder'})},
      {sep:true},
      {label:'搜索',action:()=>System.launch('helpviewer',{appId:'finder',focusSearch:true})},
    ]},
  ];
  };

  function setTopView(view){const w=frontFinderWindow();if(w){w._view=view;localStorage.setItem(VIEW_KEY,view);render(w);}}
  function goTop(path){let w=frontFinderWindow();if(!w)System.launch('finder',{path});else openPath(w,path);}

  document.addEventListener('finder-preferences-changed', (event) => {
    cachedFinderPrefs = event.detail || System.getFinderPreferences();
    openWindows.forEach((win) => {
      if (!win.isConnected || !win._side) return;
      const replacement = makeSidebar(win);
      win._side.replaceWith(replacement);
      win._side = replacement;
      render(win);
    });
  });
  document.addEventListener('finder-servers-changed', () => {
    openWindows.forEach((win) => {
      if (!win.isConnected || !win._side) return;
      const replacement = makeSidebar(win);
      win._side.replaceWith(replacement);
      win._side = replacement;
      render(win);
    });
  });

  System.registerApp({
    id:'finder',name:'Finder',icon,open,multiWindow:true,menus,showPreferences,
    commandTarget:(command, front) => ['close-window','minimize','zoom'].includes(command) ? front : frontFinderWindow(),
    about:'Leopard 文件管理器：图标、列表、分栏与 Cover Flow，Quick Look、搜索、标签、简介和智能文件夹。',
    keywords:'finder 文件 quick look cover flow 搜索 文件夹',
  });
})();
