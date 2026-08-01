// Lightweight i18n for Leopard Web (zh-CN + en only; zero build).
//
// Catalogs are deliberately loaded on demand. The entry module awaits
// initI18n() before importing any application modules, so t() remains a
// synchronous lookup everywhere after startup without downloading both large
// catalogs for every visitor.

export const SUPPORTED_LOCALES = ['zh-CN', 'en'];
export const LOCALE_LABELS = {
  'zh-CN': { zh: '简体中文', en: 'Simplified Chinese' },
  en: { zh: 'English', en: 'English' },
};

const catalogLoaders = {
  'zh-CN': () => import('./locales/zh-CN.js'),
  en: () => import('./locales/en.js'),
};
const catalogs = Object.create(null);
const catalogRequests = Object.create(null);

const STORE_KEY = 'macweb.pref.international';

let currentLocale = 'en';
let localeRequest = 0;
let initializationPromise = null;
const listeners = new Set();

export function normalizeLocale(tag) {
  if (!tag) return null;
  const raw = String(tag).replace(/_/g, '-');
  if (/^zh(-|$)/i.test(raw)) return 'zh-CN';
  if (/^en(-|$)/i.test(raw)) return 'en';
  return null;
}

function canonicalLocale(locale) {
  return normalizeLocale(locale) === 'zh-CN' ? 'zh-CN' : 'en';
}

/** Browser locale → UI language. Only zh-CN defaults to Chinese; everything else is English. */
export function detectLocale() {
  const candidates = [];
  try {
    if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
  } catch (e) {}
  try {
    if (navigator.language) candidates.push(navigator.language);
  } catch (e) {}
  for (const tag of candidates) {
    const normalized = normalizeLocale(tag);
    if (normalized === 'zh-CN') return 'zh-CN';
  }
  return 'en';
}

export function loadInternationalPrefs() {
  const base = {
    languages: null,
    region: null,
  };
  try {
    const stored = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    return Object.assign(base, stored);
  } catch (e) {
    return base;
  }
}

export function saveInternationalPrefs(patch) {
  const next = Object.assign(loadInternationalPrefs(), patch || {});
  try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch (e) {}
  return next;
}

export function defaultLanguageOrder() {
  const detected = detectLocale();
  return detected === 'zh-CN' ? ['zh-CN', 'en'] : ['en', 'zh-CN'];
}

export function resolveLanguageOrder(prefs) {
  const stored = Array.isArray(prefs?.languages) ? prefs.languages : null;
  if (!stored || !stored.length) return defaultLanguageOrder();
  const order = [];
  stored.forEach((code) => {
    const n = code === 'zh-CN' || code === 'zh' ? 'zh-CN' : code === 'en' ? 'en' : normalizeLocale(code);
    if (SUPPORTED_LOCALES.includes(n) && !order.includes(n)) order.push(n);
  });
  SUPPORTED_LOCALES.forEach((code) => {
    if (!order.includes(code)) order.push(code);
  });
  return order.length ? order : defaultLanguageOrder();
}

export function getLocale() {
  return currentLocale;
}

export function getLoadedLocales() {
  return SUPPORTED_LOCALES.filter((locale) => !!catalogs[locale]);
}

/** Load one catalog once. Import failures are retryable on the next request. */
export function ensureLocale(locale) {
  const next = canonicalLocale(locale);
  if (catalogs[next]) return Promise.resolve(next);
  if (!catalogRequests[next]) {
    catalogRequests[next] = catalogLoaders[next]().then((module) => {
      const catalog = module?.default;
      if (!catalog || typeof catalog !== 'object') {
        throw new TypeError(`Invalid ${next} locale catalog`);
      }
      catalogs[next] = catalog;
      return next;
    }).catch((error) => {
      delete catalogRequests[next];
      throw error;
    });
  }
  return catalogRequests[next];
}

export function t(key, vars) {
  const primary = catalogs[currentLocale];
  // During normal runtime the primary catalog is guaranteed to be loaded by
  // initI18n(). A loaded English catalog remains a useful fallback after a
  // runtime language switch, but is never fetched solely for fallback use.
  const fallback = catalogs.en;
  let text = primary?.[key] ?? fallback?.[key] ?? key;
  if (vars && typeof text === 'string') {
    text = text.replace(/\{(\w+)\}/g, (_, name) => (
      vars[name] == null ? `{${name}}` : String(vars[name])
    ));
  }
  return text;
}

function dispatchLocaleEvent(type, detail) {
  try {
    document.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (e) {}
}

function activateLocale(next, options) {
  const prev = currentLocale;
  currentLocale = next;
  try {
    document.documentElement.lang = next === 'zh-CN' ? 'zh-CN' : 'en';
  } catch (e) {}
  if (options.persist !== false) {
    const prefs = loadInternationalPrefs();
    const languages = resolveLanguageOrder(prefs).filter((code) => code !== next);
    languages.unshift(next);
    saveInternationalPrefs({ languages });
  }
  if (prev !== next || options.force) {
    listeners.forEach((fn) => {
      try { fn(next, prev); } catch (e) {}
    });
    dispatchLocaleEvent('locale-changed', { locale: next, previous: prev });
  }
  return next;
}

/**
 * Switch language. If its catalog was already loaded, this remains synchronous
 * for legacy callers. The first switch to an unloaded catalog returns a
 * Promise and activates only after the import succeeds. Later requests win if
 * the user changes their selection while an earlier import is in flight.
 */
export function setLocale(locale, options = {}) {
  const next = canonicalLocale(locale);
  const request = ++localeRequest;
  if (catalogs[next]) return activateLocale(next, options);

  return ensureLocale(next).then(() => {
    if (request !== localeRequest) return currentLocale;
    return activateLocale(next, options);
  }).catch((error) => {
    if (request === localeRequest) {
      dispatchLocaleEvent('locale-load-error', { locale: next, error });
      try { console.warn(`Unable to load ${next} locale`, error); } catch (e) {}
    }
    // Ignored legacy calls must not create an unhandled rejection or switch to
    // a half-loaded locale. Call ensureLocale() directly when rejection is
    // required by a caller.
    return currentLocale;
  });
}

export function onLocaleChange(fn) {
  if (typeof fn === 'function') listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Initialize and load only the preferred locale. Call before importing apps. */
export function initI18n() {
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    const prefs = loadInternationalPrefs();
    const order = resolveLanguageOrder(prefs);
    if (!Array.isArray(prefs.languages) || !prefs.languages.length) {
      saveInternationalPrefs({ languages: order });
    }
    const preferred = canonicalLocale(order[0]);
    try {
      await ensureLocale(preferred);
      activateLocale(preferred, { persist: false });
    } catch (preferredError) {
      const fallback = preferred === 'en' ? 'zh-CN' : 'en';
      try {
        await ensureLocale(fallback);
        activateLocale(fallback, { persist: false });
        dispatchLocaleEvent('locale-load-error', { locale: preferred, error: preferredError, fallback });
      } catch (fallbackError) {
        initializationPromise = null;
        throw new AggregateError([preferredError, fallbackError], 'Unable to load a Leopard Web locale');
      }
    }
    return currentLocale;
  })();
  return initializationPromise;
}

export function localeDisplayName(code, inLocale = currentLocale) {
  const labels = LOCALE_LABELS[code] || { zh: code, en: code };
  return inLocale === 'zh-CN' ? labels.zh : labels.en;
}
