// System subsystem: services
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { HOME_USER, paths, systemPaths } from '../config.js';
import { t } from '../i18n/index.js';

/** @param {Record<string, any>} sys shared system bag */
export function install(sys) {
  sys.syslogBuf = [];
  sys.syslog = function syslog(msg, src) {
    const t = new Date();
    const ts = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
    sys.syslogBuf.push({ ts, time:t.getTime(), src: src || 'kernel', msg });
    if (sys.syslogBuf.length > 500) sys.syslogBuf.shift();
    document.dispatchEvent(new CustomEvent('syslog'));
  }

  // ---------- Hardware info (real, via browser APIs) ----------
  sys.HW = (() => {
    const cores = Number(navigator.hardwareConcurrency) || 2;
    const reportedMemory = Number(navigator.deviceMemory);
    const platform = navigator.userAgentData?.platform || navigator.platform || 'Web';
    const ua = navigator.userAgent || '';
    const isMacHost = /\bMac/i.test(platform) || /Mac OS X/i.test(ua);
    const reportedModel = navigator.userAgentData?.model || '';
    function appleChipName(renderer) {
      const match = String(renderer || '').match(/\bApple\s+M\d+(?:\s+(?:Pro|Max|Ultra))?\b/i);
      if (!match) return '';
      return match[0]
        .replace(/\s+/g, ' ')
        .replace(/^apple/i, 'Apple')
        .replace(/\bm(\d+)/i, 'M$1')
        .replace(/\b(pro|max|ultra)\b/gi, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
    }
    const info = {
      model: reportedModel || (isMacHost ? 'Mac' : `${platform} ${t('hw.computer')}`),
      modelIdentifier: reportedModel || t('hw.browserPublic'),
      cores,
      processorName: isMacHost ? t('hw.appleSilicon') : `${platform} ${t('hw.cpu')}`,
      processor: isMacHost
        ? `Mac CPU (${cores} ${t('hw.cores')})`
        : `${platform} CPU (${cores} ${t('hw.cores')})`,
      processorSource: 'Navigator.hardwareConcurrency / Navigator.platform',
      memory: Number.isFinite(reportedMemory) && reportedMemory > 0 ? `${reportedMemory} GB` : t('hw.browserPublic'),
      memorySource: Number.isFinite(reportedMemory) && reportedMemory > 0
        ? 'Navigator.deviceMemory'
        : t('hw.memUnavailable'),
      screen: `${screen.width} × ${screen.height}`,
      depth: `${screen.colorDepth}${t('hw.bit')}`,
      dpr: devicePixelRatio,
      lang: navigator.language,
      platform,
      ua,
      gpu: t('hw.unknownGpu'),
      webgl: false,
      webgl2: false,
      graphicsApi: t('hw.noWebGL'),
      glVersion: '',
      glslVersion: '',
      serial: 'W8' + Math.abs(hashCode(navigator.userAgent)).toString(36).toUpperCase().slice(0, 8),
    };
    try {
      const c = document.createElement('canvas');
      const contextAttributes = {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      };
      let gl = c.getContext('webgl2', contextAttributes);
      info.webgl2 = !!gl;
      if (!gl) gl = c.getContext('webgl', contextAttributes) || c.getContext('experimental-webgl', contextAttributes);
      if (gl) {
        info.webgl = true;
        info.graphicsApi = info.webgl2 ? 'WebGL 2.0' : 'WebGL 1.0';
        info.glVersion = gl.getParameter(gl.VERSION);
        info.glslVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        info.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl.getParameter(gl.RENDERER) || 'WebGL GPU');
      }
    } catch (e) {}
    const appleChip = appleChipName(info.gpu);
    if (appleChip) {
      info.processorName = appleChip;
      info.processor = `${appleChip} (${cores} ${t('hw.cores')})`;
      info.processorSource = t('hw.gpuProbe');
    } else if (isMacHost && /\bApple\b/i.test(info.gpu) && !/\b(?:Intel|AMD)\b/i.test(info.gpu)) {
      info.processorName = t('hw.appleGpuChip');
      info.processor = `Apple silicon (${cores} ${t('hw.cores')})`;
      info.processorSource = t('hw.gpuProbe');
    } else if (isMacHost && /\bIntel\b/i.test(info.gpu)) {
      info.processorName = t('hw.intelCpu');
      info.processor = `Intel CPU (${cores} ${t('hw.cores')})`;
      info.processorSource = t('hw.gpuProbe');
    }
    function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }
    return info;
  })();

  sys.uptimeStr = function uptimeStr() {
    let s = Math.floor((Date.now() - sys.bootTime) / 1000);
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    return (h ? t('hw.uptimeH', { h }) : '') + (m ? t('hw.uptimeM', { m }) : '') + t('hw.uptimeS', { s });
  }

  sys.canDownloadVfsFile = function canDownloadVfsFile(path) {
    const node = VFS.get(path);
    return !!(node && node.type === 'file' && (typeof node.src === 'string' || node.content != null));
  }

  sys.downloadVfsFile = function downloadVfsFile(path) {
    const node = VFS.get(path);
    if (!node || node.type !== 'file') return false;
    const name = VFS.baseName(path);
    const extension = (name.split('.').pop() || '').toLowerCase();
    const mime = node.mime || ({
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      svg: 'image/svg+xml', pdf: 'application/pdf', html: 'text/html',
      htm: 'text/html', json: 'application/json', txt: 'text/plain',
    }[extension] || 'application/octet-stream');
    let href = typeof node.src === 'string' ? node.src : '';
    let revoke = false;
    if (!href && node.content != null) {
      href = URL.createObjectURL(new Blob([String(node.content)], { type: `${mime}${mime.startsWith('text/') ? ';charset=utf-8' : ''}` }));
      revoke = true;
    }
    if (!href) return false;
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (revoke) setTimeout(() => URL.revokeObjectURL(href), 3000);
    sys.syslog(`${t('u.c92781dd65')}${t('u.8838ea1073')}${t('u.805a87bccf')}${t('u.04d7e6fc2c')}: ${path}`, 'Finder');
    return true;
  }

  // ---------- Kernel extensions (kext) ----------
  sys.Kexts = (() => {
    const KEY = 'macweb.kexts.loaded';
    let loaded;
    try { loaded = new Set(JSON.parse(localStorage.getItem(KEY))); } catch (e) { loaded = null; }
    if (!loaded || !loaded.size) loaded = new Set(['System.kext', 'QuartzExtreme.kext', 'AppleHDA.kext', 'IONetworkingFamily.kext', 'AppleIntelGMA.kext', 'IOUSBFamily.kext']);
    function save() { localStorage.setItem(KEY, JSON.stringify([...loaded])); }
    function list() {
      return (VFS.list(systemPaths.extensions) || []).map((name) => {
        const n = VFS.get(systemPaths.extensions + '/' + name);
        return { name, desc: (n && n.desc) || t('u.a6ccdde117'), ver: (n && n.ver) || '1.0', loaded: loaded.has(name) };
      });
    }
    function applyEffects() {
      document.body.classList.toggle('noqe', !loaded.has('QuartzExtreme.kext'));
    }
    function load(path) {
      const p = VFS.normalize(path.startsWith('/') ? path : systemPaths.extensions + '/' + path);
      const name = VFS.baseName(p);
      if (!name.endsWith('.kext')) return { ok: false, msg: `${name}: ${t('u.e5d9c6c8a8')}${t('u.8f190c51d6')}${t('u.17d13aa49d')} (${t('u.d6e5de1933')} .kext)` };
      const node = VFS.get(p);
      if (!node) return { ok: false, msg: `${name}: ${t('u.32d427da49')}${t('u.22537e1261')}${t('u.17d13aa49d')}` };
      if (!VFS.get(systemPaths.extensions + '/' + name)) {
        VFS.putNode(systemPaths.extensions + '/' + name, { type: 'kext', desc: node.desc || t('u.7255ace89b'), ver: node.ver || '1.0' });
        sys.syslog(`${t('u.323887b194')}${t('u.cbb467379a')}${t('u.4918c19fbc')} ${name} ${t('u.fef8018ef3')}${t('u.75d3c6d4bd')}${t('u.4918c19fbc')}`, 'kextd');
      }
      loaded.add(name); save(); applyEffects();
      sys.syslog(`kext ${t('u.3647e1394b')}${t('u.5188885938')}: ${name}`, 'kextd');
      return { ok: true, msg: `${name} ${t('u.b9a13be2f9')}${t('u.51991a5d11')}` };
    }
    function unload(name) {
      if (!name.endsWith('.kext')) name += '.kext';
      if (name === 'System.kext') return { ok: false, msg: t('u.2583274285') };
      if (!loaded.has(name)) return { ok: false, msg: `${name}: ${t('u.12b0f7ffa8')}${t('u.5188885938')}` };
      loaded.delete(name); save(); applyEffects();
      sys.syslog(`kext ${t('u.58667b6228')}${t('u.5188885938')}: ${name}`, 'kextd');
      return { ok: true, msg: `${name} ${t('u.58667b6228')}${t('u.5188885938')}` };
    }
    return { list, load, unload, applyEffects, isLoaded: (n) => loaded.has(n) };
  })();


  sys.RECENTS_KEY = 'macweb.recents.v1';
  sys.recentLimits = function recentLimits() {
    const limits = { apps:10, documents:10 };
    try {
      const appearance = JSON.parse(localStorage.getItem('macweb.pref.appearance')) || {};
      if (Number.isFinite(appearance.recentApps)) limits.apps = Math.max(0, appearance.recentApps);
      if (Number.isFinite(appearance.recentDocs)) limits.documents = Math.max(0, appearance.recentDocs);
    } catch (e) {}
    return limits;
  }
  sys.loadRecentItems = function loadRecentItems() {
    try {
      const stored = JSON.parse(localStorage.getItem(sys.RECENTS_KEY));
      return {
        apps:Array.isArray(stored?.apps) ? stored.apps.filter((entry) => entry && typeof entry.id === 'string') : [],
        documents:Array.isArray(stored?.documents)
          ? stored.documents.filter((entry) => entry && typeof entry.path === 'string')
          : [],
      };
    } catch (e) {
      return { apps:[], documents:[] };
    }
  }
  sys.saveRecentItems = function saveRecentItems(recents) {
    try {
      localStorage.setItem(sys.RECENTS_KEY, JSON.stringify(recents));
      document.dispatchEvent(new CustomEvent('system-recents-changed'));
      return true;
    } catch (e) {
      return false;
    }
  }
  sys.addRecentApp = function addRecentApp(id) {
    if (!id || id === 'finder' || !sys.apps[id]) return;
    const recents = sys.loadRecentItems();
    recents.apps = [{ id, at:Date.now() }, ...recents.apps.filter((entry) => entry.id !== id)].slice(0, 50);
    sys.saveRecentItems(recents);
  }
  sys.addRecentDocument = function addRecentDocument(path, appId) {
    path = VFS.normalize(path || '');
    const node = VFS.get(path);
    if (!node || node.type !== 'file') return false;
    const recents = sys.loadRecentItems();
    recents.documents = [
      { path, appId:sys.apps[appId] ? appId : undefined, at:Date.now() },
      ...recents.documents.filter((entry) => VFS.normalize(entry.path) !== path),
    ].slice(0, 50);
    return sys.saveRecentItems(recents);
  }
  sys.clearRecentItems = function clearRecentItems() {
    const changed = sys.saveRecentItems({ apps:[], documents:[] });
    if (changed) sys.syslog(t('u.208de84aa0'), 'SystemUIServer');
    return changed;
  }
  sys.getRecentItems = function getRecentItems() {
    const recents = sys.loadRecentItems();
    const limits = sys.recentLimits();
    return {
      apps:recents.apps.filter((entry) => sys.apps[entry.id]).slice(0, limits.apps),
      documents:recents.documents.filter((entry) => VFS.get(entry.path)?.type === 'file').slice(0, limits.documents),
    };
  }
  sys.openRecentDocument = function openRecentDocument(entry) {
    if (!entry || !VFS.get(entry.path)) return false;
    if (entry.appId && sys.apps[entry.appId]) sys.launch(entry.appId, { path:entry.path });
    else System.openVfsPath?.(entry.path);
    return true;
  }

  // ---------- App registry ----------

  sys.forceQuitDialog = function forceQuitDialog() {
    const c = sys.el('div');
    c.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:10px;height:100%';
    const tip = sys.el('div', '', t('u.da839c2dc5'));
    tip.style.cssText = 'font-size:11px;color:#555;line-height:1.5';
    const list = sys.el('div', 'fq-list');
    let sel = null;
    function refresh() {
      list.innerHTML = '';
      sel = null;
      Object.values(sys.apps).filter((a) => a.windows.length).forEach((a) => {
        const row = sys.el('div', 'fq-row');
        row.innerHTML = `${a.icon}<span>${a.name}</span>`;
        row.addEventListener('click', () => {
          list.querySelectorAll('.fq-row').forEach((x) => x.classList.remove('sel'));
          row.classList.add('sel');
          sel = a.id;
        });
        list.appendChild(row);
      });
      if (!list.children.length) list.appendChild(sys.el('div', 'fq-empty', t('u.2b3e4e3e5f')));
    }
    refresh();
    const btnRow = sys.el('div');
    btnRow.style.cssText = 'text-align:right;flex:none';
    const btn = sys.el('button', 'aqua-btn default', t('u.01126495b6'));
    btn.addEventListener('click', () => {
      if (!sel) return;
      const name = sys.apps[sel].name;
      sys.quitApp(sel, true);
      sys.syslog(`${t('u.226ba66cda')}${t('u.feecb1e6ad')}: ${name}`, 'launchd');
      if (w.isConnected) refresh();
    });
    btnRow.appendChild(btn);
    c.append(tip, list, btnRow);
    const w = sys.createWindow({ app: sys.activeApp, title: t('u.1880fa6700'), width: 300, height: 330, content: c, noResize: true, bodyBg: '#ececec' });
  }

}
