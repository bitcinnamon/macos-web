import { System } from '../system/index.js';
import { VFS } from '../vfs.js';
import { Leopard } from '../leopard.js';
import { paths } from '../config.js';
import { t } from '../i18n/index.js';

// 预览 (Preview) — a document-bound Leopard image/PDF viewer.
(() => {
  const { el } = System;

  const icon = `<svg viewBox="0 0 64 64"><defs><linearGradient id="pv-paper" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#dce2e8"/></linearGradient><linearGradient id="pv-glass" x2="0" y2="1"><stop stop-color="#eef9ff" stop-opacity=".95"/><stop offset=".48" stop-color="#8cc5eb" stop-opacity=".72"/><stop offset="1" stop-color="#3874ad" stop-opacity=".9"/></linearGradient><filter id="pv-shadow"><feDropShadow dy="2" stdDeviation="1.4" flood-opacity=".45"/></filter></defs><g filter="url(#pv-shadow)"><rect x="5" y="8" width="49" height="43" rx="3" fill="url(#pv-paper)" stroke="#777"/><rect x="9" y="12" width="41" height="31" fill="#79bce5"/><circle cx="18" cy="21" r="4" fill="#ffe071"/><path d="M9 38l12-10 8 7 9-13 12 16v5H9z" fill="#4f8a50"/><circle cx="44" cy="44" r="12" fill="url(#pv-glass)" stroke="#345f8f" stroke-width="2"/><circle cx="44" cy="44" r="7" fill="none" stroke="#fff" stroke-width="1.5" opacity=".75"/><path d="m53 53 7 7" stroke="#335d86" stroke-width="4" stroke-linecap="round"/></g></svg>`;

  const button = (label, title, cls = '') => {
    const b = el('button', `preview-tool ${cls}`.trim(), label);
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    return b;
  };

  function download(arg) {
    if (arg?.path && System.canDownloadVfsFile(arg.path)) {
      System.downloadVfsFile(arg.path);
      return;
    }
    if (!arg?.src) return;
    const a = document.createElement('a');
    a.href = arg.src;
    a.download = arg.name || t('ui.3aeecfdaf7a1');
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function openPath(path) {
    const node = VFS.get(path);
    if (!node || node.type !== 'file') return false;
    System.launch('preview', { path });
    return true;
  }

  function resolveDocument(arg = {}) {
    if (!arg.path) return arg.src ? { ...arg } : null;
    const path = VFS.normalize(arg.path);
    const node = VFS.get(path);
    if (!node || node.type !== 'file') return null;
    const name = arg.name || VFS.baseName(path);
    const ext = (name.split('.').pop() || '').toLowerCase();
    const mime = node.mime || ({
      pdf:'application/pdf', svg:'image/svg+xml', png:'image/png',
      jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp',
    }[ext] || 'application/octet-stream');
    const src = arg.src || node.src || (node.content != null
      ? `data:${mime};charset=utf-8,${encodeURIComponent(String(node.content))}`
      : '');
    if (!src) return null;
    const kind = arg.kind || node.kind || (mime === 'application/pdf' || ext === 'pdf' ? 'pdf' : 'image');
    return { ...arg, path, name, src, kind, mime, node };
  }

  function chooseDocument(parent) {
    System.openPanel({
      parent, title: t('ui.af5b1c2db6f3'), startPath: paths.pictures,
      types: ['png','jpg','jpeg','gif','svg','webp','pdf'], allowUpload: true,
      onOpen: openPath,
    });
  }

  function openInspector(arg, meta) {
    const node = arg.node || (arg.path ? VFS.get(arg.path) : null);
    const formatBytes = (bytes) => {
      if (bytes < 1024) return `${bytes} ${t('app.pv2.68e65be8a361')}`;
      if (bytes < 1048576) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
      return `${(bytes / 1048576).toFixed(1)} MB`;
    };
    const measuredSize = node && arg.path ? VFS.sizeOf(arg.path) : 0;
    const sizeLabel = node
      ? (!measuredSize && typeof node.src === 'string' && !node.src.startsWith('data:') && node.content == null)
        ? t('ui.4f6367e8d5cd') : formatBytes(measuredSize)
      : '—';
    const pane = el('div', 'preview-inspector');
    const rows = [
      [t('ui.1be7ae4fc257'), arg.name || t('ui.35563060dc88')],
      [t('ui.2da1825912c4'), arg.kind === 'pdf' ? t('ui.0d68043ba5ee') : (meta.type || t('ui.baa73dd3288b'))],
      [t('app.pv2.ae9b10944115'), meta.width ? `${meta.width} × ${meta.height} ${t('app.pv2.190e6793487b')}` : '—'],
      [t('ui.2ad8b0b96fec'), sizeLabel],
      [t('ui.af71bc5cc4e3'), Number.isFinite(node?.modifiedAt) ? new Date(node.modifiedAt).toLocaleString('zh-CN') : '—'],
      [t('ui.88c34452cc46'), arg.path || t('ui.710c5f18f08c')],
      [t('ui.12e2ed4d508a'), `${Math.round(meta.scale * 100)}%`],
      [t('app.pv2.a88bddf77095'), `${meta.rotation}°`],
    ];
    pane.innerHTML = `<header><b>${t('app.pv2.1f85ed8b6264')}</b><span>ⓘ</span></header>`;
    const dl = el('dl');
    rows.forEach(([key, value]) => {
      const dt = el('dt', '', key);
      const dd = el('dd', '', value);
      dl.append(dt, dd);
    });
    pane.appendChild(dl);
    System.createWindow({
      app: 'preview', title: t('app.pv2.6b539247e570'), width: 350, height: 370,
      content: pane, noResize: true, bodyBg: '#ececec',
      autoFitContent:{ minHeight:250, maxHeight:500 },
    });
  }

  function emptyPreview() {
    const root = el('div', 'preview-empty');
    root.innerHTML = `<div>${icon}</div><h2>${t('app.pv2.d7958ab9d18a')}</h2><p>${t('app.pv2.dd7f3199060b')}</p>`;
    const openButton = el('button', 'aqua-btn default', t('ui.7e736d9399d0'));
    root.appendChild(openButton);
    const win = System.createWindow({
      app: 'preview', title: t('ui.de61aa8e1cbc'), width: 680, height: 480,
      content: root, statusbar: t('ui.ddb8539c5651'),
    });
    openButton.addEventListener('click', () => chooseDocument(win));
    win.addEventListener('leopard-command', (event) => {
      if (event.detail?.command === 'open-document') { event.preventDefault(); chooseDocument(win); }
    });
  }

  function openPdf(arg) {
    let preferences = System.getAppPreferences?.('preview') || {};
    const root = el('div', 'preview-app pdf-document');
    const sidebar = el('aside', 'preview-sidebar');
    const thumb = el('button', 'preview-thumb sel');
    thumb.innerHTML = '<span class="preview-pdf-paper"><b>PDF</b></span><small>1</small>';
    sidebar.appendChild(thumb);
    const canvas = el('main', 'preview-canvas');
    const frame = el('iframe', 'preview-pdf-frame');
    frame.title = arg.name || t('ui.0d68043ba5ee');
    frame.src = arg.src;
    canvas.appendChild(frame);
    root.append(sidebar, canvas);
    root.classList.toggle('sidebar-hidden', preferences.showSidebar === false);
    canvas.style.backgroundColor = preferences.backgroundColor || '#5b5b5b';

    const toolbar = el('div', 'preview-toolbar');
    const sideButton = button('▤', t('ui.d69cfbf99262'));
    const inspector = button('ⓘ', t('ui.3d6178edd1b4'));
    const exportButton = button('⇩', t('ui.6e5878b89d9a'));
    const spacer = el('i', 'preview-toolbar-spacer');
    toolbar.append(sideButton, spacer, inspector, exportButton);
    sideButton.addEventListener('click', () => root.classList.toggle('sidebar-hidden'));
    inspector.addEventListener('click', () => openInspector(arg, { scale: 1, rotation: 0 }));
    exportButton.addEventListener('click', () => download(arg));
    const preferencesChanged = (event) => {
      if (event.detail?.appId !== 'preview') return;
      preferences = event.detail.preferences || System.getAppPreferences?.('preview') || {};
      canvas.style.backgroundColor = preferences.backgroundColor || '#5b5b5b';
    };
    document.addEventListener('app-preferences-changed', preferencesChanged);
    const win = System.createWindow({
      app: 'preview', title: `${t('app.pv2.e0757d1f1848')} — ${arg.name || t('ui.0d68043ba5ee')}`,
      width: 820, height: 600, toolbar, content: root,
      statusbar: t('ui.6590bae05e85'),
      onClose:() => {
        document.removeEventListener('app-preferences-changed', preferencesChanged);
        frame.src = 'about:blank';
        return true;
      },
    });
    win.addEventListener('leopard-command', (event) => {
      const actions = {
        'open-document': () => chooseDocument(win),
        'toggle-sidebar': () => sideButton.click(),
        'show-inspector': () => inspector.click(),
        'save-as': () => exportButton.click(),
      };
      const action = actions[event.detail?.command];
      if (action) { event.preventDefault(); action(); }
    });
  }

  function openImage(arg) {
    let preferences = System.getAppPreferences?.('preview') || {};
    let scale = 1;
    let rotation = 0;
    let naturalWidth = 0;
    let naturalHeight = 0;
    let fitScale = 1;
    let fitActive = preferences.imageScale === 'fit';
    let win;

    const root = el('div', 'preview-app');
    const sidebar = el('aside', 'preview-sidebar');
    const thumb = el('button', 'preview-thumb sel');
    const thumbImg = el('img');
    thumbImg.src = arg.src;
    thumbImg.alt = '';
    thumb.append(thumbImg, el('small', '', '1'));
    sidebar.appendChild(thumb);
    const canvas = el('main', 'preview-canvas');
    const scroller = el('div', 'preview-scroller');
    const documentWrap = el('div', 'preview-image-wrap');
    const image = el('img', 'preview-document');
    image.src = arg.src;
    image.alt = arg.name || t('ui.0a0ce84ddefc');
    image.draggable = false;
    documentWrap.appendChild(image);
    scroller.appendChild(documentWrap);
    canvas.appendChild(scroller);
    root.append(sidebar, canvas);
    root.classList.toggle('sidebar-hidden', preferences.showSidebar === false);
    canvas.style.backgroundColor = preferences.backgroundColor || '#5b5b5b';
    image.style.imageRendering = preferences.smoothImages === false ? 'pixelated' : 'auto';

    const toolbar = el('div', 'preview-toolbar');
    const sideButton = button('▤', t('ui.d69cfbf99262'));
    const zoomOut = button('−', t('ui.11f8516f82b1'));
    const zoomIn = button('+', t('ui.d7f48a059cf3'));
    const fit = button('▣', t('ui.be89b40223ed'));
    const actual = button('1:1', t('ui.6ef49ec0bedf'), 'text');
    const rotateLeft = button('↶', t('app.pv2.8d7e57382906'));
    const rotateRight = button('↷', t('app.pv2.134de623e56c'));
    const inspector = button('ⓘ', t('ui.3d6178edd1b4'));
    const exportButton = button('⇩', t('ui.6e5878b89d9a'));
    const zoomLabel = el('span', 'preview-zoom', '100%');
    const spacer = el('i', 'preview-toolbar-spacer');
    toolbar.append(sideButton, zoomOut, zoomIn, fit, actual, rotateLeft, rotateRight, zoomLabel, spacer, inspector, exportButton);

    const updateStatus = () => {
      zoomLabel.textContent = `${Math.round(scale * 100)}%`;
      if (win) {
        win.querySelector('.win-statusbar').textContent =
          `${naturalWidth || '—'} × ${naturalHeight || '—'} ${t('app.pv2.190e6793487b')}  ·  ${Math.round(scale * 100)}%`;
      }
    };
    const applyTransform = () => {
      image.style.width = naturalWidth ? `${naturalWidth * scale}px` : 'auto';
      image.style.height = naturalHeight ? `${naturalHeight * scale}px` : 'auto';
      image.style.transform = `rotate(${rotation}deg)`;
      documentWrap.style.width = naturalWidth ? `${(rotation % 180 ? naturalHeight : naturalWidth) * scale}px` : 'auto';
      documentWrap.style.height = naturalHeight ? `${(rotation % 180 ? naturalWidth : naturalHeight) * scale}px` : 'auto';
      updateStatus();
    };
    const calculateFit = () => {
      if (!naturalWidth || !canvas.clientWidth || !canvas.clientHeight) return 1;
      const w = rotation % 180 ? naturalHeight : naturalWidth;
      const h = rotation % 180 ? naturalWidth : naturalHeight;
      return Math.min(1, Math.max(.05, (canvas.clientWidth - 48) / w, .05), Math.max(.05, (canvas.clientHeight - 48) / h, .05));
    };
    const setScale = (value, remember = false, keepFit = false) => {
      if (!keepFit) fitActive = false;
      scale = Math.max(.05, Math.min(8, value));
      applyTransform();
      if (remember) {
        preferences = System.updateAppPreferences?.('preview', { lastImageScale:scale }) || preferences;
      }
    };
    const fitDocument = () => {
      fitScale = calculateFit();
      fitActive = true;
      setScale(fitScale, false, true);
      scroller.scrollTo({ left: 0, top: 0 });
    };
    const rotate = (amount) => {
      rotation = (rotation + amount + 360) % 360;
      fitDocument();
    };

    sideButton.addEventListener('click', () => {
      root.classList.toggle('sidebar-hidden');
      if (fitActive) requestAnimationFrame(fitDocument);
    });
    zoomOut.addEventListener('click', () => setScale(scale / 1.25, true));
    zoomIn.addEventListener('click', () => setScale(scale * 1.25, true));
    fit.addEventListener('click', fitDocument);
    actual.addEventListener('click', () => setScale(1, true));
    rotateLeft.addEventListener('click', () => rotate(-90));
    rotateRight.addEventListener('click', () => rotate(90));
    inspector.addEventListener('click', () => openInspector(arg, { width: naturalWidth, height: naturalHeight, scale, rotation, type: image.currentSrc.startsWith('data:') ? t('ui.e64994a247c7') : t('ui.0a0ce84ddefc') }));
    exportButton.addEventListener('click', () => download(arg));
    canvas.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setScale(scale * (event.deltaY < 0 ? 1.12 : .89), true);
    }, { passive: false });

    let drag = null;
    scroller.addEventListener('pointerdown', (event) => {
      if (scale <= fitScale + .01) return;
      drag = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop };
      scroller.setPointerCapture(event.pointerId);
      scroller.classList.add('panning');
    });
    scroller.addEventListener('pointermove', (event) => {
      if (!drag) return;
      scroller.scrollLeft = drag.left - (event.clientX - drag.x);
      scroller.scrollTop = drag.top - (event.clientY - drag.y);
    });
    const endPan = () => { drag = null; scroller.classList.remove('panning'); };
    scroller.addEventListener('pointerup', endPan);
    scroller.addEventListener('pointercancel', endPan);

    image.addEventListener('load', () => {
      naturalWidth = image.naturalWidth;
      naturalHeight = image.naturalHeight;
      requestAnimationFrame(() => {
        if (preferences.imageScale === 'actual') setScale(1);
        else if (preferences.imageScale === 'last') setScale(Number(preferences.lastImageScale) || 1);
        else fitDocument();
      });
    }, { once: true });
    image.addEventListener('error', () => {
      canvas.classList.add('preview-error');
      canvas.textContent = t('ui.47c94b8e1f59');
    }, { once: true });

    const preferencesChanged = (event) => {
      if (event.detail?.appId !== 'preview') return;
      preferences = event.detail.preferences || System.getAppPreferences?.('preview') || {};
      canvas.style.backgroundColor = preferences.backgroundColor || '#5b5b5b';
      image.style.imageRendering = preferences.smoothImages === false ? 'pixelated' : 'auto';
    };
    document.addEventListener('app-preferences-changed', preferencesChanged);
    win = System.createWindow({
      app: 'preview', title: `${t('app.pv2.e0757d1f1848')} — ${arg.name || t('ui.0a0ce84ddefc')}`,
      width: 820, height: 590, toolbar, content: root, statusbar: t('ui.60144cc4bb25'),
      onClose:() => {
        document.removeEventListener('app-preferences-changed', preferencesChanged);
        image.src = '';
        return true;
      },
    });
    win.addEventListener('leopard-command', (event) => {
      const actions = {
        'open-document': () => chooseDocument(win),
        'toggle-sidebar': () => sideButton.click(),
        'zoom-in': () => zoomIn.click(), 'zoom-out': () => zoomOut.click(),
        'actual-size': () => actual.click(), 'zoom-fit': () => fit.click(),
        'rotate-left': () => rotateLeft.click(), 'rotate-right': () => rotateRight.click(),
        'show-inspector': () => inspector.click(), 'save-as': () => exportButton.click(),
      };
      const action = actions[event.detail?.command];
      if (action) { event.preventDefault(); action(); }
    });
    if (image.complete && image.naturalWidth) {
      naturalWidth = image.naturalWidth;
      naturalHeight = image.naturalHeight;
      requestAnimationFrame(() => {
        if (preferences.imageScale === 'actual') setScale(1);
        else if (preferences.imageScale === 'last') setScale(Number(preferences.lastImageScale) || 1);
        else fitDocument();
      });
    }
    new ResizeObserver(() => {
      if (fitActive) fitDocument();
    }).observe(canvas);
  }

  function open(arg) {
    if (!arg?.src && !arg?.path) return emptyPreview();
    const documentArg = resolveDocument(arg);
    if (!documentArg) {
      System.alertBox(t('ui.de61aa8e1cbc'), t('ui.c42a149f9846'));
      return emptyPreview();
    }
    if (documentArg.path) System.addRecentDocument?.(documentArg.path, 'preview');
    if (documentArg.kind === 'pdf') return openPdf(documentArg);
    openImage(documentArg);
  }

  System.registerApp({
    id: 'preview', name: t('ui.de61aa8e1cbc'), icon, open, multiWindow: true,
    about: t('ui.cf011c183e37'),
    keywords: t('ui.6f04f4f9ed65'),
  });
})();
