// System subsystem: application registry and first-launch module loading.
import { t } from '../i18n/index.js';

/** @param {Record<string, any>} sys shared system bag */
export function install(sys) {
  // Keep the descriptor object stable. Dock buttons and Finder items may retain
  // a reference to it, while windows are runtime state that must survive a
  // lazy descriptor being replaced by the implementation's full descriptor.
  sys.registerApp = function registerApp(app) {
    if (!app || typeof app.id !== 'string' || !app.id) {
      throw new TypeError('registerApp requires a non-empty application id');
    }

    const current = sys.apps[app.id];
    if (!current) {
      app.windows = Array.isArray(app.windows) ? app.windows : [];
      app.hidden = !!app.hidden;
      app._launchTimer = app._launchTimer ?? null;
      app._launchPendingArg = app._launchPendingArg;
      app._launchHasPendingArg = !!app._launchHasPendingArg;
      sys.apps[app.id] = app;
      return app;
    }

    const runtime = {
      windows: Array.isArray(current.windows) ? current.windows : [],
      hidden: !!current.hidden,
      launchTimer: current._launchTimer ?? null,
      launchPendingArg: current._launchPendingArg,
      launchHasPendingArg: !!current._launchHasPendingArg,
      preferencesWindow: current._preferencesWindow,
      lazyState: current._lazyState,
    };

    // Mutate instead of replacing: existing Dock click handlers deliberately
    // close over this object and must immediately see the loaded implementation.
    Object.assign(current, app);
    current.windows = runtime.windows;
    current.hidden = runtime.hidden;
    current._launchTimer = runtime.launchTimer;
    current._launchPendingArg = runtime.launchPendingArg;
    current._launchHasPendingArg = runtime.launchHasPendingArg;
    if (runtime.preferencesWindow !== undefined) current._preferencesWindow = runtime.preferencesWindow;

    if (runtime.lazyState) {
      current._lazyState = runtime.lazyState;
      if (app._lazyPlaceholder !== true) {
        runtime.lazyState.loaded = true;
        runtime.lazyState.error = null;
        delete current._lazyPlaceholder;
      }
    }
    sys.apps[app.id] = current;
    return current;
  };

  /**
   * Register the Finder/Dock-visible descriptor now and load its implementation
   * on first launch. The loader may register the full app as a side effect or
   * resolve to a descriptor (directly, as `default`, or as `app`).
   */
  sys.registerLazyApp = function registerLazyApp(descriptor, loader = descriptor?.load) {
    if (!descriptor || typeof descriptor.id !== 'string' || !descriptor.id) {
      throw new TypeError('registerLazyApp requires a non-empty application id');
    }
    if (typeof loader !== 'function') {
      throw new TypeError(`registerLazyApp requires a loader for ${descriptor.id}`);
    }

    const existing = sys.apps[descriptor.id];
    // Import maps and hot-reload harnesses may evaluate the registration entry
    // again. Never replace an implementation that has already finished loading.
    if (existing?._lazyState?.loaded && existing._lazyPlaceholder !== true) return existing;

    const state = existing?._lazyState || {
      loaded: false,
      loadPromise: null,
      launchPromise: null,
      pendingArg: undefined,
      hasPendingArg: false,
      error: null,
      attempts: 0,
    };
    state.loader = loader;

    const { load: ignoredLoad, ...visibleDescriptor } = descriptor;
    const placeholder = {
      ...visibleDescriptor,
      _lazyPlaceholder: true,
      _lazyState: state,
      // Direct callers should still go through the deduplicated launch path.
      open: (arg) => sys.launch(descriptor.id, arg),
    };
    return sys.registerApp(placeholder);
  };

  function resolveLoadedDescriptor(moduleValue, id) {
    const candidate = moduleValue?.default || moduleValue?.app || (moduleValue?.id ? moduleValue : null);
    return candidate?.id === id && typeof candidate.open === 'function' ? candidate : null;
  }

  function ensureLazyAppLoaded(app) {
    const state = app?._lazyState;
    if (!state || state.loaded) return Promise.resolve(sys.apps[app.id]);
    if (state.loadPromise) return state.loadPromise;

    state.attempts += 1;
    state.error = null;
    let loadPromise;
    loadPromise = Promise.resolve()
      // Browsers cache failed module-map entries by URL. Pass the attempt so a
      // loader can retain its canonical URL first, then cache-bust real retries.
      .then(() => state.loader(state.attempts))
      .then((moduleValue) => {
        let loadedApp = sys.apps[app.id];
        if (loadedApp?._lazyPlaceholder === true) {
          const descriptor = resolveLoadedDescriptor(moduleValue, app.id);
          if (descriptor) loadedApp = sys.registerApp(descriptor);
        }
        loadedApp = sys.apps[app.id];
        if (!state.loaded || loadedApp?._lazyPlaceholder === true || typeof loadedApp?.open !== 'function') {
          throw new Error(`Lazy module did not register application "${app.id}"`);
        }
        return loadedApp;
      })
      .catch((error) => {
        if (state.loadPromise === loadPromise) state.loadPromise = null;
        state.loaded = false;
        state.error = error;
        throw error;
      });
    state.loadPromise = loadPromise;
    return loadPromise;
  }

  function notifyLazyLoadFailure(app, error) {
    console.error('app module load failed:', app.id, error);
    sys.syslog?.(`Application module load failed: ${app.id}`, 'launchd');
    const language = document.documentElement?.lang?.toLowerCase?.() || '';
    const message = language.startsWith('zh')
      ? `无法打开“${app.name}”。应用组件加载失败，请重试。`
      : `“${app.name}” could not be opened because its application component failed to load. Please try again.`;
    sys.alertBox?.(app.name, message);
  }

  function launchReadyApp(app, id, arg) {
    const dockIcon = sys.$(`#dock .dock-icon[data-app="${id}"]`);
    if (app.windows.some((win) => win._hiddenByApp)) {
      sys.showApp(id, { focus: !arg });
      if (!arg) return true;
    }
    if (!app.multiWindow && app._launchTimer != null) {
      // Calls during the Dock bounce are coalesced; the newest target wins.
      app._launchPendingArg = arg;
      app._launchHasPendingArg = true;
      return true;
    }
    if (app.windows.length && !arg && !app.multiWindow) {
      const target = app.windows[app.windows.length - 1];
      document.dispatchEvent(new CustomEvent('system-activate-window', { detail: { window: target } }));
      sys.focusWindow(target);
      sys.setActiveApp(id);
      return true;
    }
    if (dockIcon && !app.windows.length) {
      dockIcon.classList.add('bouncing');
      setTimeout(() => dockIcon.classList.remove('bouncing'), 1700);
      const endBusy = sys.beginBusy(320);
      if (!app.multiWindow) {
        app._launchPendingArg = arg;
        app._launchHasPendingArg = true;
      }
      const timer = setTimeout(() => {
        try {
          const pendingArg = app.multiWindow
            ? arg
            : app._launchHasPendingArg ? app._launchPendingArg : undefined;
          if (app._launchTimer === timer) {
            app._launchTimer = null;
            app._launchPendingArg = undefined;
            app._launchHasPendingArg = false;
          }
          if (!app.multiWindow && app.windows.length) {
            sys.focusWindow(app.windows[app.windows.length - 1]);
            sys.setActiveApp(id);
            return;
          }
          sys.reallyOpen(app, pendingArg);
        } finally {
          endBusy();
        }
      }, 500);
      if (!app.multiWindow) app._launchTimer = timer;
      return true;
    }
    return sys.reallyOpen(app, arg);
  }

  sys.launch = function launch(id, arg) {
    const app = sys.apps[id];
    if (!app) return false;
    const state = app._lazyState;
    if (!state || state.loaded || app._lazyPlaceholder !== true) {
      return launchReadyApp(app, id, arg);
    }

    // A single continuation owns the eventual open. Concurrent launches only
    // replace its pending argument, avoiding duplicate windows after import().
    state.pendingArg = arg;
    state.hasPendingArg = true;
    if (state.launchPromise) return state.launchPromise;

    const endBusy = sys.beginBusy?.(160) || (() => {});
    let launchPromise;
    launchPromise = ensureLazyAppLoaded(app)
      .then((loadedApp) => {
        const pendingArg = state.hasPendingArg ? state.pendingArg : undefined;
        state.pendingArg = undefined;
        state.hasPendingArg = false;
        return launchReadyApp(loadedApp, id, pendingArg);
      })
      .catch((error) => {
        state.pendingArg = undefined;
        state.hasPendingArg = false;
        notifyLazyLoadFailure(app, error);
        return false;
      })
      .finally(() => {
        endBusy();
        if (state.launchPromise === launchPromise) state.launchPromise = null;
      });
    state.launchPromise = launchPromise;
    return launchPromise;
  };

  sys.reallyOpen = function reallyOpen(app, arg) {
    let opened = true;
    try { app.open(arg); } catch (e) { opened = false; console.error('app open failed:', app.id, e); }
    if (opened) sys.addRecentApp(app.id);
    sys.syslog(`${t('u.4562024dde')}${t('u.537500107f')}${t('u.b30de51667')}: ${app.name}`, 'launchd');
    sys.updateDock();
    sys.setActiveApp(app.id);
    return opened;
  };
}
