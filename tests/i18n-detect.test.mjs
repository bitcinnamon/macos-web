import assert from 'node:assert/strict';

// Isolate navigator before importing i18n.
const originalNavigator = globalThis.navigator;
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en-US', languages: ['en-US', 'en'] },
  configurable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    _m: new Map(),
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
    setItem(k, v) { this._m.set(k, String(v)); },
    removeItem(k) { this._m.delete(k); },
  },
  configurable: true,
});
Object.defineProperty(globalThis, 'document', {
  value: { documentElement: { lang: '' }, dispatchEvent() { return true; } },
  configurable: true,
});
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};

const i18n = await import('../js/i18n/index.js');

assert.equal(i18n.detectLocale(), 'en');
assert.deepEqual(i18n.getLoadedLocales(), [], 'importing i18n must not eagerly load a catalog');
await i18n.initI18n();
assert.equal(i18n.getLocale(), 'en');
assert.deepEqual(i18n.getLoadedLocales(), ['en'], 'startup loads only the selected catalog');
assert.equal(i18n.t('dialog.ok'), 'OK');

Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'zh-CN', languages: ['zh-CN', 'zh'] },
  configurable: true,
});
assert.equal(i18n.detectLocale(), 'zh-CN');

Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'fr-FR', languages: ['fr-FR'] },
  configurable: true,
});
assert.equal(i18n.detectLocale(), 'en');

// If an unloaded catalog is requested and the user immediately switches back,
// the later request wins after the first dynamic import completes.
const staleChineseRequest = i18n.setLocale('zh-CN', { persist: false, force: true });
i18n.setLocale('en', { persist: false, force: true });
await staleChineseRequest;
assert.equal(i18n.getLocale(), 'en');
assert.equal(i18n.t('dialog.ok'), 'OK');

await i18n.setLocale('zh-CN', { persist: false, force: true });
assert.equal(i18n.t('dialog.ok'), '好');
assert.equal(i18n.t('menu.logOut', { name: 'Mac OS X' }).includes('Mac OS X'), true);
assert.deepEqual(i18n.getLoadedLocales(), ['zh-CN', 'en'], 'runtime switch loads the second catalog once');

if (originalNavigator) {
  Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
}

console.log('i18n-detect assertions passed');
