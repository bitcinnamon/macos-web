// Leopard Web entry (ES module). Load with a static HTTP server, not file://.

import { CACHE_VERSION, HOME_DISPLAY_NAME } from './config.js';
import { initI18n, t, onLocaleChange, getLocale } from './i18n/index.js';

// Load exactly one locale before evaluating modules that call t() at module
// scope. t() stays synchronous for the rest of the application lifecycle.
await initI18n();
performance.mark('leopard:i18n-done');

const [
  { VFS },
  { ICONS },
  { System },
  { Leopard },
] = await Promise.all([
  import('./vfs.js'),
  import('./icons.js'),
  import('./system/index.js'),
  import('./leopard.js'),
]);
performance.mark('leopard:modules-done');

// Keep the public VFS API synchronous, but do not let Finder or applications
// observe the bootstrap tree before IndexedDB hydration/migration completes.
await VFS.ready;
performance.mark('leopard:vfs-ready');

// Application registration is intentionally deferred until the selected
// catalog and the shared system services are ready.
await import('./apps/index.js');
performance.mark('leopard:apps-done');

const APP_NAME_KEYS = {
  finder: 'app.finder',
  safari: 'app.safari',
  mail: 'app.mail',
  addressbook: 'app.addressbook',
  ichat: 'app.ichat',
  ical: 'app.ical',
  itunes: 'app.itunes',
  photobooth: 'app.photobooth',
  quicktime: 'app.quicktime',
  dvdplayer: 'app.dvdplayer',
  frontrow: 'app.frontrow',
  dictionary: 'app.dictionary',
  automator: 'app.automator',
  imagecapture: 'app.imagecapture',
  dashboard: 'app.dashboard',
  timemachine: 'app.timemachine',
  notes: 'app.notes',
  stickies: 'app.stickies',
  textedit: 'app.textedit',
  calculator: 'app.calculator',
  terminal: 'app.terminal',
  preview: 'app.preview',
  chess: 'app.chess',
  sysprefs: 'app.sysprefs',
  diskutil: 'app.diskutil',
  activity: 'app.activity',
  consoleapp: 'app.consoleapp',
  sysprofiler: 'app.sysprofiler',
  netutil: 'app.netutil',
  fontbook: 'app.fontbook',
  opengl: 'app.opengl',
  keychain: 'app.keychain',
  grab: 'app.grab',
  migration: 'app.migration',
  bootcamp: 'app.bootcamp',
};

function applyLocalizedAppNames() {
  Object.entries(APP_NAME_KEYS).forEach(([id, key]) => {
    if (System.apps[id]) System.apps[id].name = t(key);
  });
}

function refreshOpenWindows() {
  (System.windows || []).forEach((win) => {
    if (!win?.isConnected) return;
    const appId = win.dataset.app;
    const app = System.apps[appId];
    if (app && win._title && win.dataset.i18nTitle === 'app') {
      win._title.textContent = app.name;
    }
    System.applyI18nToDom?.(win);
  });
  System.applyI18nToDom?.(document);
}

function refreshChromeForLocale() {
  applyLocalizedAppNames();
  System.updateDock?.();
  System.renderDesktopIcons?.();
  System.updateTrashIcon?.();
  if (System.setActiveApp) System.setActiveApp(System.activeApp || 'finder');
  else System.renderMenuTitles?.(System.activeApp || 'finder');
  const spot = document.querySelector('#spot-input');
  if (spot) {
    spot.placeholder = t('spotlight.placeholder');
    spot.dataset.i18n = 'spotlight.placeholder';
    spot.dataset.i18nAttr = 'placeholder';
  }
  const vol = document.querySelector('#mb-volume');
  if (vol) vol.title = t('menubar.volume');
  const spotBtn = document.querySelector('#mb-spotlight');
  if (spotBtn) spotBtn.title = t('menubar.spotlight');
  System.clockTick?.();
  System.applyI18nToDom?.(document);
  const appName = document.querySelector('.mb-appname');
  if (appName && System.apps[System.activeApp || 'finder']) {
    appName.textContent = System.apps[System.activeApp || 'finder'].name;
  }
  // Status-bar extras (AirPort, Spaces, Bluetooth, Time Machine, capture)
  Leopard.refreshStatusChrome?.();
  refreshOpenWindows();
  // Notify apps that build dynamic chrome (e.g. System Preferences panes)
  document.dispatchEvent(new CustomEvent('locale-ui-refresh', { detail: { locale: getLocale() } }));
}

// Localize registered app names after side-effect imports.
applyLocalizedAppNames();
onLocaleChange(() => refreshChromeForLocale());

// Keep console / legacy debugging ergonomics.
Object.assign(globalThis, {
  VFS, ICONS, System, Leopard, CACHE_VERSION, t, getLocale, HOME_DISPLAY_NAME,
});

// Install the offline shell only after the desktop is interactive. The worker
// uses a versioned, network-first cache so a deployment cannot combine stale
// and current ES modules into one broken graph.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  document.addEventListener('leopard-ready', () => {
    navigator.serviceWorker.register(`./sw.js?v=${CACHE_VERSION}`, { scope:'./' })
      .catch((error) => console.warn('Leopard Web service worker registration failed.', error));
  }, { once:true });
}

System.boot();
Leopard.init();
refreshChromeForLocale();
performance.mark('leopard:dom-ready');

// Opt-in Core Web Vitals / boot-phase reporting. The default page pays nothing:
// perf.js is imported and its observers installed only when requested.
try {
  if (new URLSearchParams(location.search).has('perf') || location.hash === '#perf' || localStorage.getItem('macweb.perf') === '1') {
    import('./perf.js').then((module) => module.installPerf()).catch(() => {});
  }
} catch (error) { /* measurement is best-effort */ }
