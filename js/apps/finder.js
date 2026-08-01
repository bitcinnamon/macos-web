// Finder — browse the virtual file system
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="finder-left" x2="0" y2="1"><stop stop-color="#c8ecff"/><stop offset=".48" stop-color="#83c5ec"/><stop offset="1" stop-color="#3d8ac2"/></linearGradient><linearGradient id="finder-right" x2="0" y2="1"><stop stop-color="#70bce7"/><stop offset=".52" stop-color="#3184bd"/><stop offset="1" stop-color="#17639b"/></linearGradient><filter id="finder-shadow"><feDropShadow dy="2" stdDeviation="1.4" flood-opacity=".38"/></filter></defs><g filter="url(#finder-shadow)"><path d="M6 12q0-6 6-6h20v52H12q-6 0-6-6z" fill="url(#finder-left)"/><path d="M32 6h20q6 0 6 6v40q0 6-6 6H32z" fill="url(#finder-right)"/><rect x="6" y="6" width="52" height="52" rx="7" fill="none" stroke="#15517d" stroke-width="1.5"/><path d="M32 6c-6 12-8 25-3 37" fill="none" stroke="#174d78" stroke-width="1.4"/><path d="M26 6c-6 14-6 33 1 42" fill="none" stroke="#e6f7ff" stroke-width="2" opacity=".9"/><path d="M16 26q3-3 6 0M41 26q3-3 6 0" fill="none" stroke="#133c5f" stroke-width="2.2" stroke-linecap="round"/><path d="M14 42q9 8 20 5q8-2 13-8" fill="none" stroke="#123b5c" stroke-width="2.2" stroke-linecap="round"/><path d="M32 31l-2 8h5" fill="none" stroke="#123b5c" stroke-width="1.6" stroke-linecap="round"/></g></svg>`;

  function fileIcon(path) {
    const node = VFS.get(path);
    if (!node) return ICONS.textfile;
    if (node.type === 'dir') return ICONS.folder;
    if (node.type === 'app') {
      const app = System.apps[node.appId];
      return app ? app.icon : ICONS.folder;
    }
    if (node.type === 'kext') return `<svg viewBox="0 0 64 64"><path d="M32 8 L52 19 V41 L32 52 L12 41 V19 Z" fill="#c8a2e8" stroke="#7a4aa8" stroke-width="2"/><path d="M32 8 L52 19 L32 30 L12 19 Z" fill="#e0c8f2" stroke="#7a4aa8" stroke-width="2"/><path d="M32 30 V52" stroke="#7a4aa8" stroke-width="2"/><text x="32" y="46" text-anchor="middle" font-size="11" fill="#4a2a68" font-weight="bold">kext</text></svg>`;
    if (node.kind === 'workflow') return System.apps.automator?.icon || ICONS.textfile;
    if (node.kind === 'image') return `<svg viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="40" rx="3" fill="#fff" stroke="#8a8a8a" stroke-width="1.5"/><rect x="12" y="16" width="40" height="28" fill="#7ec0ea"/><circle cx="22" cy="24" r="4" fill="#ffd76e"/><path d="M12 40 l12 -10 8 7 8 -12 12 15 v4 H12z" fill="#4a8f4a"/></svg>`;
    if (node.kind === 'pdf') return `<svg viewBox="0 0 64 64"><defs><linearGradient id="pdfpaper" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#dfe5eb"/></linearGradient></defs><path d="M13 5h28l11 11v43H13z" fill="url(#pdfpaper)" stroke="#7d8792" stroke-width="1.5"/><path d="M41 5v12h11" fill="#c4ccd5" stroke="#7d8792"/><path d="M20 27h25M20 33h25M20 39h20" stroke="#a7b1bc" stroke-width="2"/><path d="M12 43h39v13H12z" fill="#d9232e" stroke="#9c121b"/><text x="31.5" y="53" text-anchor="middle" font-size="10" font-weight="bold" fill="#fff">PDF</text></svg>`;
    const extension = (VFS.baseName(path).split('.').pop() || '').toLowerCase();
    if (extension === 'workflow') return System.apps.automator?.icon || ICONS.textfile;
    if (node.kind === 'audio' || node.kind === 'video' || /^(audio|video)\//.test(node.mime || '')
        || ['mov','mp4','m4v','webm','ogv','mp3','m4a','aac','wav','ogg'].includes(extension)) {
      return System.apps.quicktime?.icon || `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="#5286c8" stroke="#304f83"/><path d="m26 20 20 12-20 12z" fill="#fff"/></svg>`;
    }
    return ICONS.textfile;
  }

  function openPath(win, path) {
    win._path = path;
    render(win);
  }

  // Open any VFS path — in the given Finder window (dirs navigate), or standalone (win = null).
  function openVfsPath(path, win) {
    const node = VFS.get(path);
    if (!node) return;
    if (node.type === 'dir') {
      if (win) { win._history.push(win._path); openPath(win, path); }
      else System.launch('finder', { path });
      return;
    }
    if (node.type === 'app') return System.launch(node.appId);
    if (node.type === 'kext') {
      const name = VFS.baseName(path);
      const loaded = System.Kexts.isLoaded(name);
      const apply = () => {
        const r = loaded ? System.Kexts.unload(name) : System.Kexts.load(name);
        System.alertBox('内核扩展', r.msg);
      };
      const parent = win || System.topWindowOf('finder');
      const opts = {
        parent, title: '内核扩展',
        headline: loaded ? `卸载“${name}”？` : `装载“${name}”？`,
        message: `${node.desc || '内核扩展'}（版本 ${node.ver || '1.0'}）\n当前状态：${loaded ? '已装载' : '未装载'}`,
        okLabel: loaded ? '卸载' : '装载', onOK: apply,
      };
      if (parent) System.confirmSheet(opts);
      else System.confirmBox({ title:'内核扩展', text:`${opts.headline}\n${opts.message}`, okLabel:opts.okLabel, onOK:apply });
      return;
    }
    if (node.kind === 'image' || node.kind === 'pdf') {
      System.addRecentDocument?.(path, 'preview');
      return System.launch('preview', { src: node.src, name: VFS.baseName(path), kind: node.kind, path });
    }
    const extension = (VFS.baseName(path).split('.').pop() || '').toLowerCase();
    if (node.kind === 'workflow' || extension === 'workflow') {
      System.addRecentDocument?.(path, 'automator');
      return System.launch('automator', { path });
    }
    if (node.kind === 'audio' || node.kind === 'video' || /^(audio|video)\//.test(node.mime || '')
        || ['mov','mp4','m4v','webm','ogv','mp3','m4a','aac','wav','ogg'].includes(extension)) {
      System.addRecentDocument?.(path, 'quicktime');
      return System.launch('quicktime', { path });
    }
    System.addRecentDocument?.(path, 'textedit');
    System.launch('textedit', { path });
  }
  const openItem = (win, path) => openVfsPath(path, win);

  function restoreItem(path) {
    const node = VFS.get(path);
    if (!node) return;
    let dest = node.from ? VFS.parentOf(node.from) : null;
    if (!dest || !VFS.isDir(dest)) dest = '/用户/roll/文稿';
    VFS.move(path, dest, { sourcePatch:{ from:null }, label:`放回“${VFS.baseName(path)}”` });
  }

  function render(win) {
    // if the folder we were showing got deleted/moved, climb to the nearest surviving parent
    while (win._path !== '/' && !VFS.isDir(win._path)) win._path = VFS.parentOf(win._path);
    const path = win._path;
    const inTrash = path === System.TRASH || path.startsWith(System.TRASH + '/');
    const main = win._main;
    main.innerHTML = '';
    const grid = el('div', 'finder-grid');
    const names = (VFS.list(path) || []).filter((n) => !n.startsWith('.'));
    names.forEach((name) => {
      const p = VFS.normalize(path + '/' + name);
      const item = el('div', 'f-icon');
      const nodeHere = VFS.get(p);
      item.dataset.path = p;
      if (nodeHere && nodeHere.type === 'dir') item.dataset.dir = '1';
      const image = el('div', 'fi-img');
      image.innerHTML = fileIcon(p);
      const label = el('div', 'fi-label');
      label.textContent = name;
      item.append(image, label);
      const select = () => {
        grid.querySelectorAll('.f-icon').forEach((x) => x.classList.remove('sel'));
        item.classList.add('sel');
      };
      item.addEventListener('click', (e) => { select(); e.stopPropagation(); });
      // 拖到桌面 / 其他文件夹 / 废纸篓
      item.addEventListener('mousedown', (e) => {
        select();
        System.startItemDrag(e, p, fileIcon(p), name);
      });
      item.addEventListener('dblclick', () => openItem(win, p));
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        select();
        const node = VFS.get(p);
        const menu = [{ label: '打开', action: () => openItem(win, p) }];
        if (System.canDownloadVfsFile(p)) {
          menu.push({ label: '下载到本地…', action: () => System.downloadVfsFile(p) });
        }
        if (inTrash) {
          menu.push({ sep: true },
            { label: '放回原位', action: () => restoreItem(p) },
            { label: '立即删除…', action: () => System.confirmSheet({
              parent: win, title:'立即删除', headline:`确定要永久删除“${name}”吗？`,
              message:'此操作无法撤销。', okLabel:'删除', danger:true,
              onOK:()=>VFS.remove(p, { record:false }),
            }) });
        } else if (node && (node.type === 'file' || node.type === 'dir')) {
          menu.push({ sep: true }, { label: '移到废纸篓', action: () => System.moveToTrash(p) });
        }
        System.contextMenu(e, menu);
      });
      grid.appendChild(item);
    });
    main.appendChild(grid);
    win._pathLabel.textContent = path === System.TRASH ? '废纸篓' : path;
    win._emptyBtn.style.display = path === System.TRASH ? '' : 'none';
    win._newFolderBtn.style.display = inTrash ? 'none' : '';
    win.querySelector('.win-statusbar').textContent = `${names.length} 项`;
    win._side.querySelectorAll('.fs-item').forEach((s) => s.classList.toggle('sel', s.dataset.path === path));
  }

  function open(arg) {
    const startPath = (arg && arg.path) || '/用户/roll';

    const layout = el('div', 'finder-layout');
    const side = el('div', 'finder-side');
    side.innerHTML = `<div class="fs-head">设备</div>`;
    const places = [
      ['/', 'Macintosh HD', ICONS.hd],
      null,
      ['/用户/roll', 'roll 的home', ICONS.folder],
      ['/用户/roll/桌面', '桌面', ICONS.folder],
      ['/用户/roll/文稿', '文稿', ICONS.folder],
      ['/用户/roll/图片', '图片', ICONS.folder],
      ['/应用程序', '应用程序', ICONS.folder],
      ['/应用程序/实用工具', '实用工具', ICONS.folder],
      ['/系统/扩展', '扩展 (kext)', ICONS.folder],
    ];
    const main = el('div', 'finder-main');

    const toolbar = el('div');
    toolbar.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%';
    const back = el('button', 'finder-toolbar-btn', '◀');
    const up = el('button', 'finder-toolbar-btn', '▲');
    const newFolder = el('button', 'finder-toolbar-btn', '新建文件夹');
    const emptyBtn = el('button', 'finder-toolbar-btn', '清倒废纸篓');
    const pathLabel = el('span', 'finder-path');
    toolbar.append(back, up, newFolder, emptyBtn, pathLabel);

    let onVfs = null;
    const win = System.createWindow({
      app: 'finder', title: 'Finder', width: 640, height: 420,
      toolbar, content: layout, statusbar: '',
      onClose: () => {
        if (onVfs) document.removeEventListener('vfs-changed', onVfs);
      },
    });
    win._main = main;
    win._side = side;
    win._pathLabel = pathLabel;
    win._emptyBtn = emptyBtn;
    win._newFolderBtn = newFolder;
    win._history = [];

    places.forEach((pl) => {
      if (!pl) { side.appendChild(el('div', 'fs-head', '位置')); return; }
      const [p, label, ic] = pl;
      const item = el('div', 'fs-item');
      item.dataset.path = p;
      item.innerHTML = `${ic}<span>${label}</span>`;
      item.addEventListener('click', () => { win._history.push(win._path); openPath(win, p); });
      side.appendChild(item);
    });
    layout.append(side, main);

    back.addEventListener('click', () => { const p = win._history.pop(); if (p) openPath(win, p); });
    up.addEventListener('click', () => { win._history.push(win._path); openPath(win, VFS.parentOf(win._path)); });
    newFolder.addEventListener('click', () => {
      System.promptSheet({
        parent:win, title:'新建文件夹', message:'请输入新文件夹的名称：',
        value:VFS.uniqueName(win._path,'未命名文件夹',''), okLabel:'新建',
        onOK:(name)=>{if(!VFS.mkdir(win._path+'/'+name))return false;render(win);},
      });
    });
    emptyBtn.addEventListener('click', () => System.emptyTrash());
    main.addEventListener('mousedown', (e) => {
      if (e.target === main || e.target.classList.contains('finder-grid'))
        main.querySelectorAll('.f-icon').forEach((x) => x.classList.remove('sel'));
    });
    main.addEventListener('contextmenu', (e) => {
      if (e.target !== main && !e.target.classList.contains('finder-grid')) return;
      e.preventDefault();
      if (win._path === System.TRASH) {
        System.contextMenu(e, [{ label: '清倒废纸篓…', action: () => System.emptyTrash(), disabled: !(VFS.list(System.TRASH) || []).length }]);
      } else {
        System.contextMenu(e, [{ label: '新建文件夹', action: () => VFS.mkdir(win._path + '/' + VFS.uniqueName(win._path, '未命名文件夹', '')) }]);
      }
    });

    // live-refresh when the VFS changes (trash / restore / terminal edits …)
    onVfs = () => render(win);
    document.addEventListener('vfs-changed', onVfs);

    openPath(win, startPath);
    win._title.textContent = 'Finder';
  }

  System.registerApp({
    id: 'finder', name: 'Finder', icon, open, multiWindow: true,
    about: '文件管理器。浏览虚拟文件系统，双击文本文件用「文本编辑」打开。',
    keywords: 'finder 文件',
  });

  // shared with the desktop (system.js)
  System.fileIconFor = fileIcon;
  System.openVfsPath = (path) => openVfsPath(path, null);
})();
