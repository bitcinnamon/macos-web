// System subsystem: windows
import { VFS } from '../vfs.js';
import { ICONS } from '../icons.js';
import { HOME_USER, paths } from '../config.js';
import { t } from '../i18n/index.js';
import {
  rebaseWindowViewportAdaptation,
  resolveWindowViewportGeometry,
  sameWindowGeometry,
} from './viewport-geometry.js';

/** @param {Record<string, any>} sys shared system bag */
export function install(sys) {
// ---------- Windows ----------
  function readWindowGeometry(win) {
    const rect = win.getBoundingClientRect();
    const computed = getComputedStyle(win);
    let left = Number.parseFloat(win.style.left);
    let top = Number.parseFloat(win.style.top);
    if (!Number.isFinite(left)) left = rect.left;
    if (!Number.isFinite(top)) top = rect.top;
    return {
      left,
      top,
      width:parseFloat(win.style.width) || parseFloat(computed.width) || rect.width,
      height:parseFloat(win.style.height) || parseFloat(computed.height) || rect.height,
    };
  }

  function viewportBounds(options) {
    const opts = options || {};
    const dockAtBottom = (document.body.dataset.dockPosition || 'bottom') === 'bottom';
    return {
      width:innerWidth,
      height:innerHeight,
      safeTop:Math.max(0, Number(opts.safeTop) || 8),
      safeBottom:Math.max(8, Number(opts.safeBottom) || (dockAtBottom ? 72 : 12)),
    };
  }

  function applyWindowGeometry(win, geometry) {
    win.style.width = `${Math.round(geometry.width)}px`;
    win.style.height = `${Math.round(geometry.height)}px`;
    win.style.left = `${Math.round(geometry.left)}px`;
    win.style.top = `${Math.round(geometry.top)}px`;
  }

  // Leopard's preference and inspector windows are content-sized rather than
  // permanently padded workspaces.  Keep that policy in WindowServer so every
  // opt-in panel gets the same measurement, screen clamping and animation.
  /** Keep a window's frame inside the visible desktop (menubar + dock safe areas). */
  sys.clampWindowToViewport = function clampWindowToViewport(win, options) {
    if (!win || win._closed || !win.isConnected || win.style.display === 'none') return false;
    if (win._minThumb) return false;
    const current = readWindowGeometry(win);
    const resolved = resolveWindowViewportGeometry(
      current,
      win._viewportAdaptation,
      viewportBounds(options),
    );
    const changed = !sameWindowGeometry(current, resolved.geometry);
    if (resolved.adaptation) win._viewportAdaptation = resolved.adaptation;
    else delete win._viewportAdaptation;
    if (!changed) return false;
    applyWindowGeometry(win, resolved.geometry);
    if (win._onResize) win._onResize(win);
    return true;
  };

  // Commit an intentional interaction without confusing it with a viewport
  // clamp. Dragging updates only the normal position (so a temporarily reduced
  // size can still recover); manual resizing updates the complete normal frame.
  sys.commitWindowViewportGeometry = function commitWindowViewportGeometry(win, fields) {
    if (!win || win._closed || !win.isConnected || !win._viewportAdaptation) return false;
    const current = readWindowGeometry(win);
    const rebased = rebaseWindowViewportAdaptation(win._viewportAdaptation, current, fields);
    const resolved = resolveWindowViewportGeometry(current, rebased, viewportBounds());
    const changed = !sameWindowGeometry(current, resolved.geometry);
    if (resolved.adaptation) win._viewportAdaptation = resolved.adaptation;
    else delete win._viewportAdaptation;
    if (changed) {
      applyWindowGeometry(win, resolved.geometry);
      if (win._onResize) win._onResize(win);
    }
    return changed;
  };

  sys.clampAllWindowsToViewport = function clampAllWindowsToViewport() {
    let count = 0;
    (sys.windows || []).forEach((win) => {
      if (sys.clampWindowToViewport(win)) count += 1;
    });
    return count;
  };

  sys.resizeWindow = function resizeWindow(win, requested) {
    if (!win || win._closed || !win.isConnected) return null;
    const options = requested || {};
    if (win._interactionCleanup) win._interactionCleanup(false);
    // Application-directed content sizing establishes a new normal frame; an
    // older viewport restore must never overwrite it later.
    delete win._viewportAdaptation;

    const rect = win.getBoundingClientRect();
    const computed = getComputedStyle(win);
    const currentWidth = parseFloat(win.style.width) || parseFloat(computed.width) || rect.width;
    const currentHeight = parseFloat(win.style.height) || parseFloat(computed.height) || rect.height;
    const minimumWidth = Math.max(160, Number(options.minWidth) || parseFloat(computed.minWidth) || 320);
    const minimumHeight = Math.max(90, Number(options.minHeight) || parseFloat(computed.minHeight) || 180);
    const dockAtBottom = (document.body.dataset.dockPosition || 'bottom') === 'bottom';
    const safeTop = Math.max(0, Number(options.safeTop) || 8);
    const safeBottom = Math.max(8, Number(options.safeBottom) || (dockAtBottom ? 72 : 12));
    const availableWidth = Math.max(minimumWidth, innerWidth - 16);
    const availableHeight = Math.max(minimumHeight, innerHeight - safeTop - safeBottom);
    const configuredMaxWidth = Number.isFinite(Number(options.maxWidth)) ? Number(options.maxWidth) : availableWidth;
    const configuredMaxHeight = Number.isFinite(Number(options.maxHeight)) ? Number(options.maxHeight) : availableHeight;
    const targetWidth = Math.min(availableWidth, configuredMaxWidth,
      Math.max(minimumWidth, Number.isFinite(Number(options.width)) ? Number(options.width) : currentWidth));
    const targetHeight = Math.min(availableHeight, configuredMaxHeight,
      Math.max(minimumHeight, Number.isFinite(Number(options.height)) ? Number(options.height) : currentHeight));

    let targetLeft = Number.parseFloat(win.style.left);
    let targetTop = Number.parseFloat(win.style.top);
    if (!Number.isFinite(targetLeft)) targetLeft = rect.left;
    if (!Number.isFinite(targetTop)) targetTop = rect.top;
    if (options.width != null && options.anchor !== 'top-left') targetLeft += (currentWidth - targetWidth) / 2;
    targetLeft = Math.min(innerWidth - 8 - targetWidth, Math.max(8, targetLeft));
    targetTop = Math.min(innerHeight - safeBottom - targetHeight, Math.max(safeTop, targetTop));

    const changed = Math.abs(currentWidth - targetWidth) > .5
      || Math.abs(currentHeight - targetHeight) > .5
      || Math.abs((Number.parseFloat(win.style.left) || rect.left) - targetLeft) > .5
      || Math.abs((Number.parseFloat(win.style.top) || rect.top) - targetTop) > .5;
    win._zoomed = null;
    const applySize = () => {
      win._contentResizeFrame = null;
      win.style.left = `${Math.round(targetLeft)}px`;
      win.style.top = `${Math.round(targetTop)}px`;
      win.style.width = `${Math.round(targetWidth)}px`;
      win.style.height = `${Math.round(targetHeight)}px`;
      if (win._onResize) win._onResize(win);
    };
    if (!changed) {
      applySize();
      if (win._contentResizeTimer == null && win._contentResizeFrame == null) {
        win.classList.remove('auto-resizing');
        win.style.removeProperty('--window-resize-duration');
      }
      return { width:targetWidth, height:targetHeight, left:targetLeft, top:targetTop };
    }

    if (win._contentResizeFrame != null) {
      cancelAnimationFrame(win._contentResizeFrame);
      win._contentResizeFrame = null;
    }
    if (win._contentResizeTimer != null) {
      clearTimeout(win._contentResizeTimer);
      win._contentResizeTimer = null;
    }
    if (win._contentResizeNotifyFrame != null) {
      cancelAnimationFrame(win._contentResizeNotifyFrame);
      win._contentResizeNotifyFrame = null;
    }

    const animate = options.animate !== false && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = Math.max(0, Number(options.duration) || 240);
    if (!animate) {
      win.classList.remove('auto-resizing');
      win.style.removeProperty('--window-resize-duration');
      applySize();
      return { width:targetWidth, height:targetHeight, left:targetLeft, top:targetTop };
    }

    win.classList.add('auto-resizing');
    win.style.setProperty('--window-resize-duration', `${duration}ms`);
    win.dispatchEvent(new CustomEvent('window-resize-start', {
      detail:{ width:targetWidth, height:targetHeight, automatic:true },
    }));
    win._contentResizeFrame = requestAnimationFrame(applySize);
    const startedAt = performance.now();
    const notifyResize = (now) => {
      if (!win.isConnected || win._closed) return;
      if (win._onResize) win._onResize(win);
      if (now - startedAt < duration + 20) win._contentResizeNotifyFrame = requestAnimationFrame(notifyResize);
      else win._contentResizeNotifyFrame = null;
    };
    win._contentResizeNotifyFrame = requestAnimationFrame(notifyResize);
    win._contentResizeTimer = setTimeout(() => {
      win._contentResizeTimer = null;
      if (!win.isConnected) return;
      win.classList.remove('auto-resizing');
      win.style.removeProperty('--window-resize-duration');
      if (win._onResize) win._onResize(win);
      win.dispatchEvent(new CustomEvent('window-resize-end', {
        detail:{ width:targetWidth, height:targetHeight, automatic:true },
      }));
    }, duration + 34);
    return { width:targetWidth, height:targetHeight, left:targetLeft, top:targetTop };
  }

  sys.fitWindowToContent = function fitWindowToContent(win, overrides) {
    if (!win || win._closed || !win.isConnected || !win._body) return null;
    const options = Object.assign({}, win._contentFitOptions || {}, overrides || {});
    let root = options.root;
    if (typeof root === 'string') root = win._body.querySelector(root);
    if (!root || !root.isConnected) root = win._body.firstElementChild;
    if (!root) return null;

    const previousScrollTop = win._body.scrollTop;
    win.classList.add('content-measuring');
    // Reading geometry flushes the temporary intrinsic-size rules. The class is
    // removed in this same task, so users never see the measuring state.
    const naturalBodyHeight = Math.max(
      win._body.scrollHeight,
      win._body.offsetHeight,
      root.scrollHeight,
      root.offsetHeight,
    );
    let chromeHeight = 0;
    Array.from(win.children).forEach((child) => {
      if (child === win._body || child.classList.contains('win-resize') || getComputedStyle(child).display === 'none') return;
      chromeHeight += child.offsetHeight;
    });
    win.classList.remove('content-measuring');
    win._body.scrollTop = previousScrollTop;

    const extraHeight = Number(options.extraHeight) || 0;
    const measuredHeight = Math.ceil(chromeHeight + naturalBodyHeight + extraHeight);
    return sys.resizeWindow(win, Object.assign({}, options, { height:measuredHeight }));
  }

  sys.requestContentFit = function requestContentFit(win, overrides) {
    if (!win || win._closed) return;
    if (win._contentFitFrame != null) cancelAnimationFrame(win._contentFitFrame);
    win._contentFitFrame = requestAnimationFrame(() => {
      win._contentFitFrame = null;
      sys.fitWindowToContent(win, overrides);
    });
  }

  sys.installContentFit = function installContentFit(win, fitOptions) {
    // A small optical inset keeps ordinary content-sized panels from ending
    // directly on the resize edge. Full-bleed panes opt out with
    // `extraHeight: 0`.
    const options = Object.assign(
      { extraHeight: 8 },
      fitOptions === true ? {} : (fitOptions || {}),
    );
    win._contentFitOptions = options;
    win.classList.add('content-fit-window');
    win._requestContentFit = (overrides) => sys.requestContentFit(win, overrides);
    const observedRoot = win._body.firstElementChild || win._body;
    const schedule = () => sys.requestContentFit(win);
    win._contentFitLayoutHandler = schedule;
    win.addEventListener('panel-layout-changed', schedule);
    observedRoot.addEventListener('load', schedule, true);
    win._contentFitObservedRoot = observedRoot;
    win._contentFitObserver = new MutationObserver((mutations) => {
      const structuralChange = mutations.some((mutation) =>
        mutation.type === 'attributes' || mutation.target === observedRoot);
      if (structuralChange) schedule();
    });
    win._contentFitObserver.observe(observedRoot, {
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:['hidden', 'open'],
    });
    sys.requestContentFit(win, { animate:options.animateInitial !== false });
  }

  sys.createWindow = function createWindow(opts) {
    // opts: {app, title, width, height, x, y, content(DOM), toolbar(DOM)?,
    // statusbar?, noResize?, autoFitContent?, bodyBg?, transparentTitle?}
    const app = sys.apps[opts.app];
    const win = sys.el('div', 'window opening');
    win._resourceController = new AbortController();
    win._resourceCleanups = new Set();
    win.dataset.app = opts.app;
    win.dataset.wid = ++sys.winSeq;
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-modal', 'false');
    const W = Math.min(opts.width || 500, innerWidth - 40);
    const H = Math.min(opts.height || 360, innerHeight - 120);
    win.style.width = W + 'px';
    win.style.height = H + 'px';
    const offset = (app.windows.length % 5) * 26;
    win.style.left = (opts.x != null ? opts.x : Math.max(10, (innerWidth - W) / 2 - 80 + offset)) + 'px';
    win.style.top = (opts.y != null ? opts.y : Math.max(30, (innerHeight - H) / 2 - 60 + offset)) + 'px';

    const tb = sys.el('div', 'titlebar');
    const traffic = sys.el('div', 'traffic');
    const btnClose = sys.el('div', 'tl-btn tl-close');
    const btnMin = sys.el('div', 'tl-btn tl-min');
    const btnZoom = sys.el('div', 'tl-btn tl-zoom');
    traffic.append(btnClose, btnMin, btnZoom);
    const initialTitle = opts.title != null ? opts.title : app.name;
    const title = sys.el('div', 'title', initialTitle);
    title.id = `window-title-${win.dataset.wid}`;
    win.setAttribute('aria-labelledby', title.id);
    [
      [btnClose, t('dialog.close')],
      [btnMin, t('window.minimize')],
      [btnZoom, t('window.zoom')],
    ].forEach(([button, label]) => {
      button.setAttribute('role', 'button');
      button.setAttribute('tabindex', '0');
      button.setAttribute('aria-label', label);
    });
    if (opts.title == null || opts.title === app.name) win.dataset.i18nTitle = 'app';
    tb.append(traffic, title);
    win.appendChild(tb);

    if (opts.toolbar) { const t = sys.el('div', 'win-toolbar'); t.appendChild(opts.toolbar); win.appendChild(t); }
    const body = sys.el('div', 'win-body');
    if (opts.bodyBg) body.style.background = opts.bodyBg;
    if (opts.content) body.appendChild(opts.content);
    win.appendChild(body);
    if (opts.statusbar != null || opts.statusbarKey) {
      const s = sys.el('div', 'win-statusbar');
      if (opts.statusbarKey) {
        s.dataset.i18n = opts.statusbarKey;
        if (opts.statusbarVars) s.dataset.i18nVars = JSON.stringify(opts.statusbarVars);
        s.textContent = t(opts.statusbarKey, opts.statusbarVars);
      } else {
        s.textContent = opts.statusbar;
      }
      win.appendChild(s);
      win._status = s;
    }
    if (!opts.noResize) {
      const grip = sys.el('div', 'win-resize');
      win.appendChild(grip);
      sys.initResize(win, grip);
    }

    sys.$('#windows').appendChild(win);
    setTimeout(() => win.classList.remove('opening'), 200);

    win._app = app;
    win._title = title;
    win._body = body;
    app.windows.push(win);
    sys.windows.push(win);
    sys.focusWindow(win);

    btnClose.addEventListener('click', (e) => { e.stopPropagation(); sys.closeWindow(win); });
    btnMin.addEventListener('click', (e) => { e.stopPropagation(); sys.minimizeWindow(win); });
    btnZoom.addEventListener('click', (e) => {
      e.stopPropagation();
      if (win._zoomed) {
        Object.assign(win.style, win._zoomed);
        win._zoomed = null;
      } else {
        win._zoomed = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
        Object.assign(win.style, { left: '8px', top: '8px', width: (innerWidth - 16) + 'px', height: (innerHeight - 110) + 'px' });
      }
      delete win._viewportAdaptation;
      if (opts.onResize) opts.onResize(win);
    });
    [btnClose, btnMin, btnZoom].forEach((button) => button.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      button.click();
    }));
    win.addEventListener('mousedown', () => { sys.focusWindow(win); sys.setActiveApp(opts.app); });
    sys.initDrag(win, tb);
    if (opts.onResize) win._onResize = opts.onResize;
    if (opts.onClose) win._onClose = opts.onClose;
    if (opts.autoFitContent) sys.installContentFit(win, opts.autoFitContent);
    return win;
  }

  // A window owns all transient resources created for its content. New apps
  // should use these helpers instead of hand-maintaining document listeners,
  // timers, media tracks, and object URLs in independent onClose handlers.
  sys.windowSignal = function windowSignal(win) {
    return win?._resourceController?.signal || null;
  };

  sys.addWindowCleanup = function addWindowCleanup(win, cleanup) {
    if (!win || typeof cleanup !== 'function' || win._closed) return () => {};
    win._resourceCleanups?.add(cleanup);
    return () => win._resourceCleanups?.delete(cleanup);
  };

  sys.listenWindow = function listenWindow(win, target, type, listener, options) {
    if (!target?.addEventListener || typeof listener !== 'function') return () => {};
    const signal = sys.windowSignal(win);
    const eventOptions = typeof options === 'boolean'
      ? { capture:options, signal }
      : Object.assign({}, options || {}, signal ? { signal } : {});
    target.addEventListener(type, listener, eventOptions);
    return () => target.removeEventListener(type, listener, eventOptions);
  };

  sys.setWindowTimeout = function setWindowTimeout(win, callback, delay) {
    const id = setTimeout(() => {
      win?._resourceCleanups?.delete(cancel);
      if (!win?._closed) callback();
    }, delay);
    const cancel = () => clearTimeout(id);
    sys.addWindowCleanup(win, cancel);
    return id;
  };

  sys.setWindowInterval = function setWindowInterval(win, callback, delay) {
    const id = setInterval(() => { if (!win?._closed) callback(); }, delay);
    sys.addWindowCleanup(win, () => clearInterval(id));
    return id;
  };

  sys.trackWindowMedia = function trackWindowMedia(win, stream) {
    if (stream?.getTracks) sys.addWindowCleanup(win, () => stream.getTracks().forEach((track) => track.stop()));
    return stream;
  };

  sys.trackWindowObjectURL = function trackWindowObjectURL(win, url) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      sys.addWindowCleanup(win, () => URL.revokeObjectURL(url));
    }
    return url;
  };

  sys.focusWindow = function focusWindow(win) {
    if (!win || win._closed) return;
    if (win._hiddenByApp) {
      win._hiddenByApp = false;
      win.classList.remove('app-hidden');
      win.style.display = '';
      if (win._app) win._app.hidden = win._app.windows.some((candidate) => candidate._hiddenByApp);
    }
    const focused = document.activeElement;
    if (focused && focused !== document.body && !win.contains(focused) && typeof focused.blur === 'function') focused.blur();
    const i = sys.windows.indexOf(win);
    if (i >= 0) sys.windows.splice(i, 1);
    sys.windows.push(win);
    sys.windows.forEach((w, idx) => {
      w.style.zIndex = 100 + idx;
      w.classList.toggle('inactive', w !== win);
    });
  }

  sys.topVisibleWindow = function topVisibleWindow() {
    for (let i = sys.windows.length - 1; i >= 0; i--) {
      const win = sys.windows[i];
      if (win.isConnected && win.style.display !== 'none' && !win._closing) return win;
    }
    return null;
  }

  sys.runWindowCloseHandler = function runWindowCloseHandler(win, force, reason) {
    if (win._onCloseDone) return true;
    let allowed = true;
    try {
      if (win._onClose) allowed = win._onClose(win, { reason: reason || 'close', force: !!force }) !== false;
    } catch (e) {
      console.error('window close cleanup failed:', win.dataset.app, e);
    }
    if (allowed || force) win._onCloseDone = true;
    return allowed || force;
  }

  sys.detachWindow = function detachWindow(win) {
    if (!win || win._closed) return false;
    win._closed = true;
    if (win._resourceController && !win._resourceController.signal.aborted) {
      win._resourceController.abort();
    }
    if (win._resourceCleanups) {
      for (const cleanup of [...win._resourceCleanups]) {
        try { cleanup(); } catch (error) { console.warn('window resource cleanup failed', error); }
      }
      win._resourceCleanups.clear();
    }
    if (win._interactionCleanup) {
      win._interactionCleanup(false);
      win._interactionCleanup = null;
    }
    if (win._closeTimer != null) {
      clearTimeout(win._closeTimer);
      win._closeTimer = null;
    }
    if (win._minTimer != null) {
      clearTimeout(win._minTimer);
      win._minTimer = null;
    }
    if (win._restoreTimer != null) {
      clearTimeout(win._restoreTimer);
      win._restoreTimer = null;
    }
    if (win._contentFitFrame != null) {
      cancelAnimationFrame(win._contentFitFrame);
      win._contentFitFrame = null;
    }
    if (win._contentResizeFrame != null) {
      cancelAnimationFrame(win._contentResizeFrame);
      win._contentResizeFrame = null;
    }
    if (win._contentResizeNotifyFrame != null) {
      cancelAnimationFrame(win._contentResizeNotifyFrame);
      win._contentResizeNotifyFrame = null;
    }
    if (win._contentResizeTimer != null) {
      clearTimeout(win._contentResizeTimer);
      win._contentResizeTimer = null;
    }
    if (win._contentFitObserver) {
      win._contentFitObserver.disconnect();
      win._contentFitObserver = null;
    }
    if (win._contentFitLayoutHandler) {
      win.removeEventListener('panel-layout-changed', win._contentFitLayoutHandler);
      win._contentFitObservedRoot?.removeEventListener('load', win._contentFitLayoutHandler, true);
      win._contentFitLayoutHandler = null;
      win._contentFitObservedRoot = null;
    }
    if (win._minThumb) {
      win._minThumb.remove();
      win._minThumb = null;
      sys.invalidateDockMagnify();
    }
    win.remove();
    const wi = sys.windows.indexOf(win); if (wi >= 0) sys.windows.splice(wi, 1);
    const ai = win._app.windows.indexOf(win); if (ai >= 0) win._app.windows.splice(ai, 1);
    return true;
  }

  sys.updateAfterWindowClose = function updateAfterWindowClose() {
    sys.updateDock();
    const top = sys.topVisibleWindow();
    if (top) { sys.focusWindow(top); sys.setActiveApp(top.dataset.app); }
    else sys.setActiveApp('finder');
  }

  sys.closeWindow = function closeWindow(win) {
    if (!win || win._closed || win._closing) return;
    if (win._interactionCleanup) win._interactionCleanup(false);
    win._closing = true;
    if (!sys.runWindowCloseHandler(win, false, 'close')) {
      win._closing = false;
      return;
    }
    win.classList.add('closing');
    win._closeTimer = setTimeout(() => {
      if (!sys.detachWindow(win)) return;
      sys.updateAfterWindowClose();
    }, 180);
  }

  sys.minimizeWindow = function minimizeWindow(win) {
    if (!win || win._closed || win._closing || win._minThumb || win._minTimer != null || win.style.display === 'none') return;
    if (win._interactionCleanup) win._interactionCleanup(false);
    if (win._restoreTimer != null) {
      clearTimeout(win._restoreTimer);
      win._restoreTimer = null;
    }
    const dockRight = sys.$('#dock-right');
    const thumb = sys.el('div', 'dock-min');
    const thumbTitle = sys.el('div', 'dm-title');
    const thumbLabel = sys.el('div', 'dock-label');
    thumbTitle.textContent = win._title.textContent;
    thumbLabel.textContent = win._title.textContent;
    const iconSvg = win._app.icon;
    const thumbIcon = sys.el('div');
    thumbIcon.style.cssText = 'position:absolute;inset:2px 2px 10px;opacity:.85';
    thumbIcon.innerHTML = iconSvg;
    thumb.append(thumbIcon, thumbTitle, thumbLabel);
    dockRight.appendChild(thumb);
    sys.invalidateDockMagnify();
    // genie-ish: scale toward the dock
    const thumbRect = thumb.getBoundingClientRect();
    const r = thumbRect.width ? thumbRect : { left: innerWidth / 2 + 100, top: innerHeight - 40 };
    const wr = win.getBoundingClientRect();
    win.classList.add('minimizing');
    win.style.transformOrigin = '50% 50%';
    const dx = (r.left + 22) - (wr.left + wr.width / 2);
    const dy = (r.top + 22) - (wr.top + wr.height / 2);
    win.style.transform = `translate(${dx}px, ${dy}px) scale(.06)`;
    win.style.opacity = '0';
    win._minTimer = setTimeout(() => {
      win._minTimer = null;
      if (!win.isConnected || !win._minThumb) return;
      win.style.display = 'none';
      const top = sys.topVisibleWindow();
      if (top) { sys.focusWindow(top); sys.setActiveApp(top.dataset.app); }
      else sys.setActiveApp('finder');
    }, 300);
    win._minThumb = thumb;
    thumb.addEventListener('click', () => sys.restoreWindow(win));
  }

  sys.restoreWindow = function restoreWindow(win) {
    if (!win || win._closed) return;
    win._hiddenByApp = false;
    win.classList.remove('app-hidden');
    if (win._app) win._app.hidden = false;
    if (win._minTimer != null) {
      clearTimeout(win._minTimer);
      win._minTimer = null;
    }
    if (win._restoreTimer != null) {
      clearTimeout(win._restoreTimer);
      win._restoreTimer = null;
    }
    if (win._minThumb) {
      win._minThumb.remove();
      win._minThumb = null;
      sys.invalidateDockMagnify();
    }
    win.style.display = '';
    requestAnimationFrame(() => {
      if (!win.isConnected || win._minThumb) return;
      win.style.transform = '';
      win.style.opacity = '';
      win._restoreTimer = setTimeout(() => {
        win._restoreTimer = null;
        if (!win._minThumb) win.classList.remove('minimizing');
      }, 320);
    });
    sys.focusWindow(win);
    sys.setActiveApp(win.dataset.app);
  }

  sys.hideApp = function hideApp(id) {
    const app = sys.apps[id];
    if (!app) return false;
    let changed = false;
    app.windows.forEach((win) => {
      if (!win.isConnected || win._closed || win._closing || win._minThumb || win.style.display === 'none') return;
      win._hiddenByApp = true;
      win.classList.add('app-hidden');
      win.style.display = 'none';
      changed = true;
    });
    app.hidden = app.windows.some((win) => win._hiddenByApp);
    if (!changed) return false;
    const top = sys.topVisibleWindow();
    if (top) {
      sys.focusWindow(top);
      sys.setActiveApp(top.dataset.app);
    } else {
      sys.setActiveApp('finder');
    }
    document.dispatchEvent(new CustomEvent('application-visibility-changed', { detail:{ appId:id, hidden:true } }));
    return true;
  }

  sys.showApp = function showApp(id, options) {
    const app = sys.apps[id];
    if (!app) return false;
    let changed = false;
    app.windows.forEach((win) => {
      if (!win.isConnected || !win._hiddenByApp) return;
      win._hiddenByApp = false;
      win.classList.remove('app-hidden');
      win.style.display = '';
      changed = true;
    });
    app.hidden = false;
    const target = [...app.windows].reverse().find((win) =>
      win.isConnected && win.style.display !== 'none' && !win._closing);
    if (target && options?.focus !== false) {
      sys.focusWindow(target);
      sys.setActiveApp(id);
    }
    if (changed) {
      document.dispatchEvent(new CustomEvent('application-visibility-changed', { detail:{ appId:id, hidden:false } }));
    }
    return changed;
  }

  sys.hideOtherApps = function hideOtherApps(keepId) {
    Object.keys(sys.apps).forEach((id) => {
      if (id !== keepId) sys.hideApp(id);
    });
    const front = sys.topWindowOf(keepId);
    if (front) {
      sys.focusWindow(front);
      sys.setActiveApp(keepId);
    }
  }

  sys.showAllApps = function showAllApps() {
    let changed = false;
    Object.keys(sys.apps).forEach((id) => {
      if (sys.apps[id].windows.some((win) => win._hiddenByApp)) {
        changed = sys.showApp(id, { focus:false }) || changed;
      }
    });
    const front = sys.topVisibleWindow();
    if (front) {
      sys.focusWindow(front);
      sys.setActiveApp(front.dataset.app);
    }
    return changed;
  }

  sys.initDrag = function initDrag(win, handle) {
    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('.tl-btn') || sys.exposeOn || win._closing || win.classList.contains('minimizing')) return;
      e.preventDefault();
      win.classList.remove('opening');
      const sx = e.clientX, sy = e.clientY;
      const rect = win.getBoundingClientRect();
      const ox = Number.parseFloat(win.style.left) || rect.left;
      const oy = Number.parseFloat(win.style.top) || rect.top;
      const minL = 60 - rect.width;
      let nextLeft = ox;
      let nextTop = oy;
      let frameId = 0;

      if (win._interactionCleanup) win._interactionCleanup(false);
      win.classList.add('dragging');
      document.documentElement.classList.add('window-interacting');

      function updatePosition(ev) {
        nextLeft = Math.min(innerWidth - 60, Math.max(minL, ox + (ev.clientX - sx)));
        nextTop = Math.min(innerHeight - 60, Math.max(0, oy + (ev.clientY - sy)));
      }
      function paint() {
        frameId = 0;
        win.style.transform = `translate3d(${nextLeft - ox}px, ${nextTop - oy}px, 0)`;
      }
      function mv(ev) {
        updatePosition(ev);
        if (!frameId) frameId = requestAnimationFrame(paint);
      }
      function cleanup(commit, ev) {
        removeEventListener('mousemove', mv);
        removeEventListener('mouseup', up);
        if (frameId) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        }
        if (commit && ev) updatePosition(ev);
        if (commit) {
          win.style.left = nextLeft + 'px';
          win.style.top = nextTop + 'px';
          sys.commitWindowViewportGeometry(win, ['left', 'top']);
        }
        win.style.transform = '';
        win.classList.remove('dragging');
        document.documentElement.classList.remove('window-interacting');
        if (win._interactionCleanup === cleanup) win._interactionCleanup = null;
      }
      function up(ev) { cleanup(true, ev); }
      win._interactionCleanup = cleanup;
      addEventListener('mousemove', mv);
      addEventListener('mouseup', up);
    });
  }

  sys.initResize = function initResize(win, grip) {
    grip.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || win._closing || win.classList.contains('minimizing')) return;
      e.preventDefault(); e.stopPropagation();
      const sx = e.clientX, sy = e.clientY;
      const rect = win.getBoundingClientRect();
      const ow = rect.width, oh = rect.height;
      let nextWidth = ow;
      let nextHeight = oh;
      let frameId = 0;

      if (win._interactionCleanup) win._interactionCleanup(false);
      win.classList.add('resizing');
      document.documentElement.classList.add('window-interacting', 'window-resize-active');

      function updateSize(ev) {
        const computed = getComputedStyle(win);
        const minimumWidth = Math.max(160,parseFloat(computed.minWidth) || 320);
        const minimumHeight = Math.max(90,parseFloat(computed.minHeight) || 180);
        nextWidth = Math.max(minimumWidth, ow + (ev.clientX - sx));
        nextHeight = Math.max(minimumHeight, oh + (ev.clientY - sy));
      }
      function paint() {
        frameId = 0;
        win.style.width = nextWidth + 'px';
        win.style.height = nextHeight + 'px';
        if (win._onResize) win._onResize(win);
      }
      function mv(ev) {
        updateSize(ev);
        if (!frameId) frameId = requestAnimationFrame(paint);
      }
      function cleanup(commit, ev) {
        removeEventListener('mousemove', mv);
        removeEventListener('mouseup', up);
        if (frameId) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        }
        if (commit && ev) updateSize(ev);
        if (commit) {
          paint();
          sys.commitWindowViewportGeometry(win, ['left', 'top', 'width', 'height']);
        }
        win.classList.remove('resizing');
        document.documentElement.classList.remove('window-interacting', 'window-resize-active');
        if (win._interactionCleanup === cleanup) win._interactionCleanup = null;
      }
      function up(ev) { cleanup(true, ev); }
      win._interactionCleanup = cleanup;
      addEventListener('mousemove', mv);
      addEventListener('mouseup', up);
    });
  }

  sys.topWindowOf = function topWindowOf(appId) {
    for (let i = sys.windows.length - 1; i >= 0; i--)
      if (sys.windows[i].dataset.app === appId && sys.windows[i].style.display !== 'none') return sys.windows[i];
    return null;
  };

  /** Set status bar text; pass an i18n key (+ optional vars) to keep it locale-refreshable. */
  sys.setWindowStatus = function setWindowStatus(win, textOrKey, vars) {
    if (!win?._status) return;
    const looksLikeKey = typeof textOrKey === 'string'
      && /^(status|finder|common|toolbar|app|menu|dialog|prefs)\./.test(textOrKey);
    if (looksLikeKey) {
      win._status.dataset.i18n = textOrKey;
      if (vars && typeof vars === 'object') win._status.dataset.i18nVars = JSON.stringify(vars);
      else delete win._status.dataset.i18nVars;
      win._status.textContent = t(textOrKey, vars);
      return;
    }
    delete win._status.dataset.i18n;
    delete win._status.dataset.i18nVars;
    win._status.textContent = textOrKey == null ? '' : String(textOrKey);
  };

  sys.applyI18nToDom = function applyI18nToDom(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (!key) return;
      let vars = {};
      try { vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : {}; } catch (e) {}
      const attr = el.dataset.i18nAttr;
      const value = t(key, vars);
      if (attr) el.setAttribute(attr, value);
      else el.textContent = value;
    });
  };
}
