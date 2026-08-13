// System subsystem: shell
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { HOME_USER, HOME_DISPLAY_NAME, paths } from '../config.js';
import { t, getLocale } from '../i18n/index.js';
import { html } from '../escape.js';
import {
  clampDesktopPosition,
  recoverLegacyDesktopPositions,
} from './viewport-geometry.js';

/** @param {Record<string, any>} sys shared system bag */
export function install(sys) {
  // ---------- Dock preferences (System Preferences → Dock) ----------
  sys.dockCfg = {
    size: 48,
    magnify: true,
    magnifySize: 1.42,
    position: 'bottom',
    minimizeEffect: 'genie',
    animateOpen: true,
    autoHide: false,
    indicators: true,
  };
  try {
    Object.assign(sys.dockCfg, JSON.parse(localStorage.getItem('macweb.dock')) || {});
  } catch (e) {}
  sys.applyDockCfg = function applyDockCfg() {
    const dock = sys.$('#dock');
    if (dock) {
      if (sys.dockCfg.size !== 48) dock.style.setProperty('--dock-size', `${sys.dockCfg.size}px`);
      else dock.style.removeProperty('--dock-size');
    }
    document.body.dataset.dockPosition = sys.dockCfg.position || 'bottom';
    document.body.classList.toggle('dock-auto-hide', !!sys.dockCfg.autoHide);
    document.body.classList.toggle('dock-hide-indicators', sys.dockCfg.indicators === false);
    try {
      localStorage.setItem('macweb.dock', JSON.stringify(sys.dockCfg));
    } catch (e) {}
    if (!sys.dockCfg.magnify) sys.dockMagnifyController?.reset?.();
  };

// ---------- Dock ----------
  sys.buildDock = function buildDock() {
    const cont = sys.$('#dock-apps');
    cont.innerHTML = '';
    // Leopard-like default Dock. Custom games remain available in Applications
    // instead of displacing the era-defining system applications.
    const defaultOrder = ['finder', 'dashboard', 'mail', 'safari', 'ichat', 'addressbook', 'ical', 'itunes', 'photobooth', 'quicktime', 'sysprefs'];
    let order = defaultOrder;
    try {
      const savedOrder = JSON.parse(localStorage.getItem('macweb.dock.order'));
      if (Array.isArray(savedOrder) && savedOrder.length) order = savedOrder.filter((id) => sys.apps[id]);
    } catch (e) {}
    order.forEach((id) => {
      const d = sys.makeDockAppIcon(id);
      if (d) cont.appendChild(d);
    });
    // trash
    const right = sys.$('#dock-right');
    right.innerHTML = '';
    const trash = sys.el('div', 'dock-icon');
    trash.setAttribute('role', 'button');
    trash.setAttribute('tabindex', '0');
    sys.trashEl = trash;
    sys.updateTrashIcon();
    trash.addEventListener('click', sys.openTrash);
    trash.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      sys.contextMenu(e, [
        { label: t('menu.open'), action: sys.openTrash },
        { sep: true },
        { label: t('menu.emptyTrash'), action: sys.emptyTrash, disabled: !sys.trashCount() },
      ]);
    });
    trash.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      sys.openTrash();
    });
    right.appendChild(trash);
    sys.initMagnify();
  }

  sys.makeDockAppIcon = function makeDockAppIcon(id) {
    const app = sys.apps[id];
    if (!app) return null;
    const d = sys.el('div', 'dock-icon');
    d.dataset.app = id;
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    d.setAttribute('aria-label', app.name);
    d.innerHTML = `${app.icon}<div class="di-reflect">${app.icon}</div><div class="dock-label">${html(app.name)}</div><div class="run-dot"></div>`;
    d.addEventListener('click', () => {
      if (app.windows.some((w) => w._hiddenByApp)) {
        sys.showApp(id);
        return;
      }
      const minimized = app.windows.find((w) => w._minThumb);
      if (app.windows.length && app.windows.every((w) => w.style.display === 'none') && minimized) sys.restoreWindow(minimized);
      else sys.launch(id);
    });
    d.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      d.click();
    });
    return d;
  }

  sys.persistDockOrder = function persistDockOrder() {
    const order = Array.from(document.querySelectorAll('#dock-apps .dock-icon[data-app]'), (n) => n.dataset.app);
    localStorage.setItem('macweb.dock.order', JSON.stringify(order));
    return order;
  }

  sys.addToDock = function addToDock(id, before) {
    if (!sys.apps[id]) return false;
    const existing = document.querySelector(`#dock-apps .dock-icon[data-app="${CSS.escape(id)}"]`);
    if (existing) return true;
    const icon = sys.makeDockAppIcon(id);
    const cont = sys.$('#dock-apps');
    cont.insertBefore(icon, before?.closest?.('#dock-apps .dock-icon') || null);
    sys.persistDockOrder();
    sys.initMagnify();
    sys.updateDock();
    sys.syslog(`${sys.apps[id].name} ${t('u.d3dcb4b1ea')}${t('u.3f01eab8a5')} Dock`, 'Dock');
    return true;
  }

  sys.removeFromDock = function removeFromDock(id) {
    if (id === 'finder') return false;
    const icon = document.querySelector(`#dock-apps .dock-icon[data-app="${CSS.escape(id)}"]`);
    if (!icon) return false;
    icon.classList.add('dock-poof');
    setTimeout(() => {
      icon.remove();
      sys.persistDockOrder();
      sys.initMagnify();
    }, 180);
    sys.syslog(`${sys.apps[id]?.name || id} ${t('u.79a9863b2b')} Dock ${t('u.2f752c005e')}`, 'Dock');
    return true;
  }

  // ---------- Trash ----------
  sys.TRASH = paths.trash;
  sys.trashEl = null;
  sys.trashCount = function trashCount() { return (VFS.list(sys.TRASH) || []).length; }
  sys.updateTrashIcon = function updateTrashIcon() {
    if (!sys.trashEl) return;
    const ic = sys.trashCount() ? ICONS.trashFull : ICONS.trash;
    sys.trashEl.innerHTML = `${ic}<div class="di-reflect">${ic}</div><div class="dock-label">${t('trash.empty')}</div>`;
    sys.trashEl.setAttribute('aria-label', t('trash.empty'));
  }
  sys.openTrash = function openTrash() { sys.launch('finder', { path: sys.TRASH }); }
  sys.emptyTrash = function emptyTrash() {
    const n = sys.trashCount();
    if (!n) { sys.alertBox(t('trash.empty'), t('dialog.emptyTrashText')); return; }
    const perform = () => {
      const paths = (VFS.list(sys.TRASH) || []).map((name) => VFS.normalize(`${sys.TRASH}/${name}`));
      VFS.transaction(t('dialog.emptyTrash'),
        () => paths.forEach((path) => VFS.remove(path, { record:false })),
        { paths, record:false });
      sys.syslog(t('dialog.emptyTrash'), 'Finder');
    };
    if (sys.getFinderPreferences().warnEmptyTrash === false) {
      perform();
      return;
    }
    sys.confirmBox({
      title: t('dialog.emptyTrash'),
      text: t('dialog.emptyTrashText') + (n ? ` (${n})` : ''),
      okLabel: t('dialog.emptyTrash'),
      onOK: perform,
    });
  }

  // ---------- Drag: Finder / Desktop moves, app aliases ----------
  sys.startItemDrag = function startItemDrag(e, path, iconHtml, label, paths) {
    if (e.button !== 0) return false;
    const dragPaths = [...new Set((Array.isArray(paths) && paths.length ? paths : [path]).map((p) => VFS.normalize(p)))]
      .filter((p) => VFS.get(p));
    if (!dragPaths.length) return false;
    const sx = e.clientX, sy = e.clientY;
    let ghost = null, moved = false;
    let springTarget = null;
    let springTimer = 0;
    const clearSpring = () => {
      clearTimeout(springTimer);
      springTimer = 0;
      springTarget = null;
    };
    const prepareSpring = (target) => {
      const prefs = sys.getFinderPreferences();
      const path = target?.kind === 'dir' && target.el ? target.path : null;
      if (!prefs.springLoaded || !path || dragPaths.includes(path) || path === springTarget) return;
      clearSpring();
      springTarget = path;
      springTimer = setTimeout(() => {
        springTimer = 0;
        if (springTarget !== path || !VFS.isDir(path)) return;
        sys.launch('finder', { path, forceNew:true, springLoaded:true });
        sys.syslog(`Spring-loaded folder: ${path}`, 'Finder');
      }, 220 + prefs.springDelay * 900);
    };
    function mv(ev) {
      if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
      if (!ghost) {
        ghost = sys.el('div', 'drag-ghost');
        const img = sys.el('div', 'dg-img');
        img.innerHTML = iconHtml;
        const caption = sys.el('div', 'dg-label');
        caption.textContent = label;
        ghost.append(img, caption);
        if (dragPaths.length > 1) {
          const badge = sys.el('span', 'dg-count', String(dragPaths.length));
          ghost.appendChild(badge);
        }
        document.body.appendChild(ghost);
        moved = true;
      }
      ghost.style.left = (ev.clientX - 26) + 'px';
      ghost.style.top = (ev.clientY - 26) + 'px';
      const t = sys.dropTargetAt(ev, ghost);
      document.querySelectorAll('.drop-hot').forEach((x) => x.classList.remove('drop-hot'));
      if (t && t.el) t.el.classList.add('drop-hot');
      if (t?.kind === 'dir' && t.el) prepareSpring(t);
      else clearSpring();
    }
    function up(ev) {
      removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
      clearSpring();
      document.querySelectorAll('.drop-hot').forEach((x) => x.classList.remove('drop-hot'));
      if (!moved) { if (ghost) ghost.remove(); return; }
      const t = sys.dropTargetAt(ev, ghost);
      if (ghost) ghost.remove();
      if (!t) return;
      if (t.kind === 'trash') dragPaths.forEach(sys.moveToTrash);
      else if (t.kind === 'dir') dragPaths.forEach((source) => sys.dropInto(source, t.path, ev));
      else if (t.kind === 'dock') {
        const node = VFS.get(dragPaths[0]);
        if (node?.type === 'app' && node.appId) sys.addToDock(node.appId, t.before);
      }
    }
    addEventListener('mousemove', mv);
    addEventListener('mouseup', up);
    return true;
  }

  sys.dropTargetAt = function dropTargetAt(ev, ghost) {
    if (ghost) ghost.style.display = 'none';
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    if (ghost) ghost.style.display = '';
    if (!under) return null;
    if (sys.trashEl && (under === sys.trashEl || sys.trashEl.contains(under))) return { kind: 'trash', el: sys.trashEl };
    const dockApps = under.closest('#dock-apps');
    if (dockApps) return { kind: 'dock', el: dockApps, before: under.closest('.dock-icon[data-app]') };
    const desk = under.closest('#desktop-icons, #desktop');
    if (desk && !under.closest('.window')) return { kind: 'dir', path: sys.DESK, el: null };
    const folder = under.closest('[data-dir="1"][data-path]');
    if (folder) return { kind: 'dir', path: folder.dataset.path, el: folder };
    const fwin = under.closest('.window[data-app="finder"]');
    if (fwin && fwin._path) return { kind: 'dir', path: fwin._path, el: null };
    return null;
  }

  // 应用拖到别处 → 生成别名（原应用留在 /应用程序）；其余走移动
  sys.dropInto = function dropInto(src, dstDir, ev) {
    src = VFS.normalize(src); dstDir = VFS.normalize(dstDir);
    const node = VFS.get(src);
    if (!node) return;
    if (ev?.altKey && node.type !== 'app') {
      const copied = VFS.copy(src, dstDir);
      if (copied && dstDir === sys.DESK) sys.placeDeskIcon(VFS.baseName(copied), ev);
      return;
    }
    if (VFS.parentOf(src) === dstDir) { if (dstDir === sys.DESK) sys.placeDeskIcon(VFS.baseName(src), ev); return; }
    if (node.type === 'app') {
      const base = VFS.baseName(src).replace(/\.app$/, '');
      const name = VFS.uniqueName(dstDir, base + t('u.b4805ed8cc'), '.app');
      VFS.putNode(dstDir + '/' + name, { type: 'app', appId: node.appId, alias: true });
      sys.syslog(`${t('u.a96e439f22')}${t('u.d0314a9633')}${t('u.81d4aecdad')}: ${name}`, 'Finder');
      if (dstDir === sys.DESK) sys.placeDeskIcon(name, ev);
      return;
    }
    const r = VFS.move(src, dstDir);
    if (r && dstDir === sys.DESK) sys.placeDeskIcon(VFS.baseName(r), ev);
  }

  // 落到桌面时，图标停在鼠标位置
  sys.placeDeskIcon = function placeDeskIcon(name, ev) {
    if (!ev) return;
    const cont = sys.$('#desktop-icons');
    const r = cont.getBoundingClientRect();
    sys.deskPos[name] = {
      x: Math.max(0, Math.min(ev.clientX - r.left - 42, cont.clientWidth - 86)),
      y: Math.max(0, Math.min(ev.clientY - r.top - 26, cont.clientHeight - 92)),
    };
    localStorage.setItem('macweb.deskpos', JSON.stringify(sys.deskPos));
    sys.renderDesktopIcons();
  }

  sys.moveToTrash = function moveToTrash(path) {
    path = VFS.normalize(path);
    const node = VFS.get(path);
    if (!node || path === sys.TRASH || path.startsWith(sys.TRASH + '/')) return false;
    const r = VFS.move(path, sys.TRASH, {
      sourcePatch: { from:path },
      label: `${t('u.4170cd5063')}“${VFS.baseName(path)}”${t('u.318bb3899b')}${t('u.662bb363f2')}${t('u.fd4d78dca3')}`,
    });
    if (r) sys.syslog(`${t('u.ef0c241f93')}${t('u.f007eff899')}${t('u.93f022cb20')}: ${VFS.baseName(path)}`, 'Finder');
    return !!r;
  }

  sys.updateDock = function updateDock() {
    document.querySelectorAll('#dock-apps .dock-icon').forEach((d) => {
      const app = sys.apps[d.dataset.app];
      d.classList.toggle('running', !!(app && app.windows.length));
      if (app) {
        d.setAttribute('aria-label', app.name);
        const label = d.querySelector('.dock-label');
        if (label) label.textContent = app.name;
      }
    });
  }

  sys.initMagnify = function initMagnify() {
    const dock = sys.$('#dock');
    if (sys.dockMagnifyController) sys.dockMagnifyController.destroy();
    const icons = () => Array.from(dock.querySelectorAll('.dock-icon'));
    let iconList = [];
    let centers = [];
    let active = false;
    let dirty = true;
    let frameId = 0;
    let trackingOutside = false;
    let dockBounds = null;

    function measure() {
      iconList = icons();
      // Read every box before writing any transform so pointer movement cannot
      // alternate layout reads and style writes for each Dock icon.
      const rects = iconList.map((ic) => ic.getBoundingClientRect());
      const vertical = sys.dockCfg.position === 'left' || sys.dockCfg.position === 'right';
      centers = rects.map((r) => vertical ? r.top + r.height / 2 : r.left + r.width / 2);
      dockBounds = dock.getBoundingClientRect();
      dirty = false;
    }
    function paint() {
      frameId = 0;
      if (!active || !sys.dockCfg.magnify) return;
      if (dirty) measure();
      iconList.forEach((ic, i) => {
        const d = Math.abs(sys.pointerX - centers[i]);
        const t = Math.max(0, 1 - d / 130);
        const scale = 1 + (Math.max(1.1, +(sys.dockCfg.magnifySize || 1.42)) - 1) * t * t;
        ic.style.transform = `scale(${scale.toFixed(3)})`;
        ic.style.zIndex = Math.round(t * 10);
      });
    }
    function schedule() {
      if (!frameId) frameId = requestAnimationFrame(paint);
    }
    function onMove(e) {
      if (!sys.dockCfg.magnify) {
        reset();
        return;
      }
      sys.pointerX = (sys.dockCfg.position === 'left' || sys.dockCfg.position === 'right') ? e.clientY : e.clientX;
      active = true;
      if (!trackingOutside) {
        trackingOutside = true;
        addEventListener('mousemove', onGlobalMove, { passive: true });
      }
      dock.classList.add('magnifying');
      schedule();
    }
    function onGlobalMove(e) {
      if (!active) return;
      const r = dockBounds || dock.getBoundingClientRect();
      dockBounds = r;
      const pad = 40;
      if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) reset();
    }
    function reset() {
      active = false;
      if (trackingOutside) {
        trackingOutside = false;
        removeEventListener('mousemove', onGlobalMove);
      }
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
      dock.classList.remove('magnifying');
      icons().forEach((ic) => { ic.style.transform = ''; ic.style.zIndex = ''; });
    }
    function invalidate() {
      dirty = true;
      dockBounds = null;
      if (active) schedule();
    }
    function onResize() { invalidate(); }

    dock.addEventListener('mousemove', onMove);
    dock.addEventListener('mouseleave', reset);
    addEventListener('resize', onResize, { passive: true });
    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(invalidate) : null;
    if (resizeObserver) resizeObserver.observe(dock);

    sys.dockMagnifyController = {
      invalidate,
      reset,
      destroy() {
        reset();
        dock.removeEventListener('mousemove', onMove);
        dock.removeEventListener('mouseleave', reset);
        removeEventListener('resize', onResize);
        if (resizeObserver) resizeObserver.disconnect();
      },
    };
  }

  sys.invalidateDockMagnify = function invalidateDockMagnify() {
    if (sys.dockMagnifyController) sys.dockMagnifyController.invalidate();
  }

  // ---------- Desktop icons (rendered from VFS 桌面, draggable, right-click menu) ----------
  sys.DESK = paths.desktop;
  sys.deskPos = {};
  // Runtime-only normal positions survive a render while the viewport is
  // temporarily small. Only explicit user moves are persisted in deskPos.
  sys._desktopNormalPositions = Object.create(null);
  try { sys.deskPos = JSON.parse(localStorage.getItem('macweb.deskpos')) || {}; } catch (e) {}
  const DESKTOP_LAYOUT_VERSION_KEY = 'macweb.deskpos.layout.v2';
  try { sys._desktopLayoutAuditPending = localStorage.getItem(DESKTOP_LAYOUT_VERSION_KEY) !== '1'; }
  catch (e) { sys._desktopLayoutAuditPending = false; }

  function auditLegacyDesktopPositions(items, viewportWidth) {
    if (!sys._desktopLayoutAuditPending || viewportWidth < 900) return false;
    const recovery = recoverLegacyDesktopPositions(sys.deskPos, items, viewportWidth);
    sys._desktopLayoutAuditPending = false;
    if (recovery.recovered) sys.deskPos = recovery.positions;
    try {
      if (recovery.recovered) localStorage.setItem('macweb.deskpos', JSON.stringify(sys.deskPos));
      localStorage.setItem(DESKTOP_LAYOUT_VERSION_KEY, '1');
    } catch (e) {}
    return recovery.recovered;
  }

  sys.renderDesktopIcons = function renderDesktopIcons() {
    const cont = sys.$('#desktop-icons');
    cont.innerHTML = '';
    const prefs = sys.getFinderPreferences();
    const items = [];
    if (prefs.desktop.hardDisks) {
      items.push({ key: 'Macintosh HD', label: t('desktop.macintoshHd'), icon: ICONS.hd, path: null });
    }
    if (prefs.desktop.connectedServers) {
      const hostLabel = t('desktop.usersMac', { name: HOME_DISPLAY_NAME });
      items.push({ key: hostLabel, label: hostLabel, icon: ICONS.folder, path: paths.public });
    }
    (VFS.list(sys.DESK) || []).filter((n) => !n.startsWith('.')).forEach((n) => {
      const p = sys.DESK + '/' + n;
      items.push({ key: n, label: n, icon: System.fileIconFor ? System.fileIconFor(p) : ICONS.textfile, path: p });
    });
    const cw = cont.clientWidth || innerWidth, chh = cont.clientHeight || (innerHeight - 22);
    auditLegacyDesktopPositions(items, cw);
    items.forEach((it, i) => {
      const d = sys.el('div', 'desk-icon');
      d.setAttribute('role', 'button');
      d.setAttribute('tabindex', '0');
      d.setAttribute('aria-label', it.label);
      const img = sys.el('div', 'di-img');
      img.innerHTML = it.icon;
      const caption = sys.el('div', 'di-label');
      caption.textContent = it.label;
      d.append(img, caption);
      const pos = sys.deskPos[it.key]
        || sys._desktopNormalPositions[it.key]
        || { x:cw - 96, y:8 + i * 92 };
      d._normalDesktopPosition = { x:Number(pos.x) || 0, y:Number(pos.y) || 0 };
      sys._desktopNormalPositions[it.key] = Object.assign({}, d._normalDesktopPosition);
      const visiblePosition = clampDesktopPosition(d._normalDesktopPosition, { width:cw, height:chh });
      d.style.left = `${visiblePosition.x}px`;
      d.style.top = `${visiblePosition.y}px`;
      const select = () => {
        document.querySelectorAll('.desk-icon').forEach((x) => x.classList.remove('selected'));
        d.classList.add('selected');
      };
      const doOpen = () => it.path ? System.openVfsPath(it.path) : sys.launch('finder', { path: '/' });
      d.addEventListener('dblclick', doOpen);
      d.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); doOpen(); }
        else if (event.key === ' ') { event.preventDefault(); select(); }
      });
      d.addEventListener('mousedown', (e) => {
        select();
        if (e.button !== 0) return;
        const sx = e.clientX, sy = e.clientY;
        const ox = parseFloat(d.style.left), oy = parseFloat(d.style.top);
        let moved = false;
        function mv(ev) {
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true;
          if (!moved) return;
          d.style.left = Math.max(0, Math.min(ox + ev.clientX - sx, cont.clientWidth - 86)) + 'px';
          d.style.top = Math.max(0, Math.min(oy + ev.clientY - sy, cont.clientHeight - 92)) + 'px';
          const target = it.path && sys.dropTargetAt(ev, d);
          document.querySelectorAll('.drop-hot').forEach((x) => x.classList.remove('drop-hot'));
          if (target && target.el) target.el.classList.add('drop-hot');
        }
        function up(ev) {
          removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
          document.querySelectorAll('.drop-hot').forEach((x) => x.classList.remove('drop-hot'));
          if (!moved) return;
          // 拖到废纸篓、Finder 文件夹或 Finder 当前目录
          if (it.path) {
            const target = sys.dropTargetAt(ev, d);
            if (target && target.kind === 'trash' && sys.moveToTrash(it.path)) {
              delete sys.deskPos[it.key];
              delete sys._desktopNormalPositions[it.key];
              localStorage.setItem('macweb.deskpos', JSON.stringify(sys.deskPos));
              return;
            }
            if (target && target.kind === 'dir' && target.path !== sys.DESK && VFS.move(it.path, target.path)) {
              delete sys.deskPos[it.key];
              delete sys._desktopNormalPositions[it.key];
              localStorage.setItem('macweb.deskpos', JSON.stringify(sys.deskPos));
              return;
            }
          }
          sys.deskPos[it.key] = { x: parseFloat(d.style.left), y: parseFloat(d.style.top) };
          d._normalDesktopPosition = Object.assign({}, sys.deskPos[it.key]);
          sys._desktopNormalPositions[it.key] = Object.assign({}, d._normalDesktopPosition);
          localStorage.setItem('macweb.deskpos', JSON.stringify(sys.deskPos));
        }
        addEventListener('mousemove', mv);
        addEventListener('mouseup', up);
      });
      d.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        select();
        const menu = [{ label: t('desktop.open'), action: doOpen }];
        if (it.path && sys.canDownloadVfsFile(it.path)) menu.push({ label: t('desktop.download'), action: () => sys.downloadVfsFile(it.path) });
        if (it.path) menu.push({ sep: true }, { label: t('desktop.moveToTrash'), action: () => sys.moveToTrash(it.path) });
        sys.contextMenu(e, menu);
      });
      cont.appendChild(d);
    });
  }

  sys.buildDesktop = function buildDesktop() {
    sys.renderDesktopIcons();
    sys.$('#desktop').addEventListener('mousedown', (e) => {
      if (e.target === sys.$('#desktop') || e.target === sys.$('#desktop-icons')) {
        document.querySelectorAll('.desk-icon').forEach((x) => x.classList.remove('selected'));
        sys.setActiveApp('finder');
      }
    });
    sys.$('#desktop').addEventListener('contextmenu', (e) => {
      if (e.target !== sys.$('#desktop') && e.target !== sys.$('#desktop-icons')) return;
      e.preventDefault();
      sys.contextMenu(e, [
        { label: t('desktop.newFolder'), action: () => VFS.mkdir(sys.DESK + '/' + VFS.uniqueName(sys.DESK, t('desktop.untitledFolder'), '')) },
        { sep: true },
        { label: t('desktop.changeDesktop'), action: () => sys.launch('sysprefs', { pane: 'desktop' }) },
      ]);
    });
  }

  // ---------- Spotlight ----------
  sys.initSpotlight = function initSpotlight() {
    const panel = sys.$('#spotlight'), input = sys.$('#spot-input'), results = sys.$('#spot-results');
    function toggle(show) {
      panel.classList.toggle('hidden', !show);
      input.setAttribute('aria-expanded', String(show));
      if (show) { input.value = ''; results.innerHTML = ''; input.focus(); }
      else if (document.activeElement === input) input.blur();
    }
    sys.$('#mb-spotlight').addEventListener('click', () => toggle(panel.classList.contains('hidden')));
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'Space') { e.preventDefault(); toggle(panel.classList.contains('hidden')); }
      if (e.key === 'Escape') toggle(false);
    });
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#spotlight') && !e.target.closest('#mb-spotlight')) toggle(false);
    });
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      results.innerHTML = '';
      if (!q) return;
      Object.values(sys.apps)
        .filter((a) => a.name.toLowerCase().includes(q) || a.id.includes(q) || (a.keywords || '').includes(q))
        .slice(0, 6)
        .forEach((a, i) => {
          const item = sys.el('div', 'spot-item' + (i === 0 ? ' sel' : ''));
          item.innerHTML = `${a.icon}<span>${html(a.name)}</span>`;
          item.addEventListener('click', () => { toggle(false); sys.launch(a.id); });
          results.appendChild(item);
        });
    });
    input.addEventListener('keydown', (e) => {
      const items = [...results.querySelectorAll('.spot-item')];
      if (!items.length) return;
      const selected = Math.max(0, items.findIndex((item) => item.classList.contains('sel')));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        const next = (selected + direction + items.length) % items.length;
        items.forEach((item, index) => {
          const active = index === next;
          item.classList.toggle('sel', active);
          item.setAttribute('aria-selected', String(active));
        });
        input.setAttribute('aria-activedescendant', items[next].id || '');
        items[next].scrollIntoView({ block:'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        (items[selected] || items[0]).click();
      }
    });
  }

  // ---------- Sound: system beep + menubar volume slider ----------
  sys.BEEP_FREQS = {
    glass: [880, 1320], basso: [110, 165], ping: [1500], funk: [220, 277, 330],
    hero: [523, 659, 784], pop: [660], purr: [140, 148], sosumi: [740, 554],
    submarine: [98, 196], tink: [1760, 2093], bottle: [390, 585], blow: [185, 247],
    frog: [165, 196, 147], morse: [660, 660, 440],
  };
  sys.getSound = function getSound() {
    const s = { volume: 0.6, muted: false, beep: 'glass' };
    try { Object.assign(s, JSON.parse(localStorage.getItem('macweb.sound')) || {}); } catch (e) {}
    return s;
  }
  sys.beep = function beep(kind, volume) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.02, 0.5 * volume), ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
      g.connect(ctx.destination);
      (sys.BEEP_FREQS[kind] || sys.BEEP_FREQS.glass).forEach((f) => {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = 0.5;
        o.connect(og); og.connect(g);
        o.start(); o.stop(ctx.currentTime + 0.7);
      });
      setTimeout(() => ctx.close(), 900);
    } catch (e) {}
  }
  sys.volumeIconSvg = function volumeIconSvg(s) {
    const lvl = s.muted ? 0 : s.volume;
    const waves = lvl <= 0 ? 0 : (lvl < 0.55 ? 1 : 2);
    return `<svg width="16" height="14" viewBox="0 0 16 14"><path d="M1 5h3l4-4v12L4 9H1z" fill="#333"/>` +
      (waves >= 1 ? `<path d="M10 4.5a4 4 0 010 5" stroke="#333" stroke-width="1.3" fill="none" stroke-linecap="round"/>` : '') +
      (waves >= 2 ? `<path d="M12 2.5a7 7 0 010 9" stroke="#333" stroke-width="1.3" fill="none" stroke-linecap="round"/>` : '') +
      (s.muted ? `<line x1="10" y1="2.5" x2="15" y2="11.5" stroke="#333" stroke-width="1.4" stroke-linecap="round"/>` : '') +
      `</svg>`;
  }
  sys.updateVolumeIcon = function updateVolumeIcon() { sys.$('#mb-volume').innerHTML = sys.volumeIconSvg(sys.getSound()); }

  sys.toggleVolumePopup = function toggleVolumePopup(anchor) {
    if (sys.openMenu && sys.openMenu.anchor === anchor) { sys.closeMenus(); return; }
    sys.closeMenus();
    const dd = sys.el('div', 'menu-dropdown vol-pop');
    const s = sys.getSound();
    const wrap = sys.el('div', 'vol-slider-wrap');
    const input = sys.el('input');
    input.type = 'range'; input.min = 0; input.max = 100;
    input.value = Math.round((s.muted ? 0 : s.volume) * 100);
    wrap.appendChild(input);
    const mute = sys.el('div', 'vol-mute');
    mute.title = t('menubar.mute');
    const paintMute = () => { mute.innerHTML = sys.volumeIconSvg(sys.getSound()); };
    paintMute();
    dd.append(wrap, mute);
    input.addEventListener('input', () => {
      const s2 = sys.getSound();
      s2.volume = input.value / 100;
      s2.muted = false;
      localStorage.setItem('macweb.sound', JSON.stringify(s2));
      sys.updateVolumeIcon(); paintMute();
    });
    input.addEventListener('change', () => {
      const s2 = sys.getSound();
      if (!s2.muted && s2.volume > 0) sys.beep(s2.beep, s2.volume); // feedback pop on release
    });
    mute.addEventListener('click', () => {
      const s2 = sys.getSound();
      s2.muted = !s2.muted;
      localStorage.setItem('macweb.sound', JSON.stringify(s2));
      input.value = s2.muted ? 0 : Math.round(s2.volume * 100);
      sys.updateVolumeIcon(); paintMute();
    });
    const r = anchor.getBoundingClientRect();
    dd.style.left = Math.round(r.left + r.width / 2 - 20) + 'px';
    dd.style.top = '22px';
    document.body.appendChild(dd);
    anchor.classList.add('open');
    sys.openMenu = { anchor, dd };
  }

  // ---------- Clock (menubar; format prefs live in 系统偏好设置 → 日期与时间) ----------
  sys.clockTick = null;
  sys.getClockPrefs = function getClockPrefs() {
    const prefs = { h24: true, showDay: true, showDate: false, showSec: false };
    try { Object.assign(prefs, JSON.parse(localStorage.getItem('macweb.clock')) || {}); } catch (e) {}
    return prefs;
  }
  sys.updateClockPrefs = function updateClockPrefs(patch) {
    const prefs = Object.assign(sys.getClockPrefs(), patch);
    localStorage.setItem('macweb.clock', JSON.stringify(prefs));
    if (sys.clockTick) sys.clockTick();
  }
  sys.clockMenuItems = function clockMenuItems() {
    const prefs = sys.getClockPrefs();
    const now = new Date();
    const locale = (typeof getLocale === 'function' ? getLocale() : null) || document.documentElement.lang || 'en';
    const check = (on) => (on ? '  ✓' : '');
    return [
      { label: now.toLocaleString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', { dateStyle: 'full', timeStyle: 'medium' }), disabled: true },
      { sep: true },
      { label: `${t('clock.use24h')}${check(prefs.h24)}`, action: () => sys.updateClockPrefs({ h24: !prefs.h24 }) },
      { label: `${t('clock.showDay')}${check(prefs.showDay)}`, action: () => sys.updateClockPrefs({ showDay: !prefs.showDay }) },
      { label: `${t('clock.showDate')}${check(prefs.showDate)}`, action: () => sys.updateClockPrefs({ showDate: !prefs.showDate }) },
      { label: `${t('clock.showSec')}${check(prefs.showSec)}`, action: () => sys.updateClockPrefs({ showSec: !prefs.showSec }) },
      { sep: true },
      { label: t('clock.openIcal'), action: () => sys.launch('ical') },
      { label: t('clock.openPrefs'), action: () => sys.launch('sysprefs', { pane: 'datetime' }) },
    ];
  };
  sys.startClock = function startClock() {
    const clock = sys.$('#mb-clock');
    const pad = (n) => String(n).padStart(2, '0');
    function tick() {
      const p = sys.getClockPrefs();
      const d = new Date();
      const days = t('clock.days');
      const dayNames = Array.isArray(days) ? days : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      let hh = d.getHours();
      let ampm = '';
      if (!p.h24) {
        ampm = (hh < 12 ? t('clock.am') : t('clock.pm')) + (document.documentElement.lang === 'zh-CN' ? '' : ' ');
        hh = hh % 12 || 12;
      }
      const parts = [];
      if (p.showDate) parts.push(t('clock.monthDay', { m: d.getMonth() + 1, d: d.getDate() }));
      if (p.showDay) parts.push(dayNames[d.getDay()]);
      parts.push(`${ampm}${hh}:${pad(d.getMinutes())}${p.showSec ? `:${pad(d.getSeconds())}` : ''}`);
      clock.textContent = parts.join(' ');
      const locale = document.documentElement.lang === 'zh-CN' ? 'zh-CN' : 'en-US';
      clock.title = d.toLocaleString(locale, { dateStyle: 'full', timeStyle: 'medium' });
    }
    tick();
    sys.clockTick = tick;
    setInterval(tick, 1000);
  };

  // ---------- Display brightness & energy saver (prefs from 系统偏好设置) ----------
  sys.applyBrightness = function applyBrightness() {
    let b = 1;
    try { b = JSON.parse(localStorage.getItem('macweb.display'))?.brightness ?? 1; } catch (e) {}
    let ov = sys.$('#brightness-ov');
    if (!ov) { ov = sys.el('div'); ov.id = 'brightness-ov'; document.body.appendChild(ov); }
    ov.style.opacity = ((1 - b) * 0.75).toFixed(3);
  }
  sys.idleTimer = null;
  sys.initEnergySaver = function initEnergySaver() {
    const reset = () => {
      if (sys.idleTimer) clearTimeout(sys.idleTimer);
      let mins = 0;
      try { mins = JSON.parse(localStorage.getItem('macweb.energy'))?.sleepMin || 0; } catch (e) {}
      if (mins > 0) sys.idleTimer = setTimeout(() => sys.sleepScreen(), mins * 60000);
    };
    ['mousemove', 'mousedown', 'keydown'].forEach((ev) => addEventListener(ev, reset, { passive: true }));
    reset();
  }

  // ---------- Exposé (F9) — GPU-composited window overview ----------
  sys.exposeOn = false;
  sys.toggleExpose = function toggleExpose() {
    const visible = sys.windows.filter((w) => w.style.display !== 'none');
    if (!sys.exposeOn && !visible.length) return;
    sys.exposeOn = !sys.exposeOn;
    document.body.classList.toggle('expose', sys.exposeOn);
    if (sys.exposeOn) {
      visible.forEach((w) => {
        if (w._interactionCleanup) w._interactionCleanup(false);
      });
      const n = visible.length;
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const cw = innerWidth / cols, ch = (innerHeight - 120) / rows;
      const rects = visible.map((w) => w.getBoundingClientRect());
      visible.forEach((w, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const wr = rects[i];
        const scale = Math.min(cw * 0.82 / wr.width, ch * 0.82 / wr.height, 0.9);
        const tx = c * cw + cw / 2 - (wr.left + wr.width / 2);
        const ty = r * ch + ch / 2 + 30 - (wr.top + wr.height / 2);
        w.style.transition = 'transform .3s cubic-bezier(.25,.6,.35,1)';
        w.style.transform = `translate(${tx}px, ${ty}px) scale(${scale.toFixed(3)})`;
        w.classList.add('exposed');
        w._exposeClick = () => { sys.toggleExpose(); sys.focusWindow(w); sys.setActiveApp(w.dataset.app); };
        w.addEventListener('click', w._exposeClick, { capture: true, once: true });
      });
      sys.syslog(t('u.d3d6000863'), 'WindowServer');
    } else {
      sys.windows.forEach((w) => {
        w.style.transform = '';
        w.classList.remove('exposed');
        if (w._exposeClick) { w.removeEventListener('click', w._exposeClick, { capture: true }); w._exposeClick = null; }
        setTimeout(() => { if (!sys.exposeOn) w.style.transition = ''; }, 320);
      });
    }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F9' || e.key === 'F3') { e.preventDefault(); sys.toggleExpose(); }
    else if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'Escape') { e.preventDefault(); sys.forceQuitDialog(); }
    else if (e.key === 'Escape' && sys.exposeOn) sys.toggleExpose();
  });

  /** Keep desktop icons inside the current desktop bounds after viewport resize. */
  sys.clampDesktopIconsToViewport = function clampDesktopIconsToViewport() {
    const cont = sys.$('#desktop-icons');
    if (!cont) return 0;
    const cw = cont.clientWidth || innerWidth;
    const ch = cont.clientHeight || Math.max(0, innerHeight - 22);
    if (sys._desktopLayoutAuditPending && cw >= 900) {
      sys.renderDesktopIcons();
      return cont.querySelectorAll('.desk-icon').length;
    }
    let changed = 0;
    cont.querySelectorAll('.desk-icon').forEach((icon) => {
      let left = parseFloat(icon.style.left);
      let top = parseFloat(icon.style.top);
      if (!Number.isFinite(left)) left = 0;
      if (!Number.isFinite(top)) top = 0;
      const normalPosition = icon._normalDesktopPosition || { x:left, y:top };
      icon._normalDesktopPosition = normalPosition;
      const next = clampDesktopPosition(normalPosition, { width:cw, height:ch });
      const nextLeft = next.x;
      const nextTop = next.y;
      if (Math.abs(nextLeft - left) > .5 || Math.abs(nextTop - top) > .5) {
        icon.style.left = `${Math.round(nextLeft)}px`;
        icon.style.top = `${Math.round(nextTop)}px`;
        changed += 1;
      }
    });
    return changed;
  };

  sys.handleViewportResize = function handleViewportResize() {
    if (sys._viewportResizeFrame) cancelAnimationFrame(sys._viewportResizeFrame);
    sys._viewportResizeFrame = requestAnimationFrame(() => {
      sys._viewportResizeFrame = 0;
      sys.clampAllWindowsToViewport?.();
      sys.clampDesktopIconsToViewport?.();
      sys.invalidateDockMagnify?.();
    });
  };

  sys.installViewportResizeRuntime = function installViewportResizeRuntime() {
    if (sys._viewportResizeInstalled) return;
    sys._viewportResizeInstalled = true;
    addEventListener('resize', sys.handleViewportResize, { passive: true });
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', sys.handleViewportResize, { passive: true });
    }
  };
}
