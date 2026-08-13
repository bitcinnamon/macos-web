// Contract: menubar chrome + System Preferences UI strings are localized (en / zh-CN).
// Also guards against bulk-i18n catalog poison (ellipsis-only, HTML/JS leaks, nested t() corruption).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

const { t, setLocale, getLocale, initI18n } = await import(
  pathToFileURL(join(root, 'js/i18n/index.js')).href
);

const must = [
  'menubar.volume', 'menubar.mute', 'menubar.spotlight',
  'desktop.newFolder', 'desktop.changeDesktop', 'menu.open',
  'clock.use24h', 'clock.showDay',
  'prefs.showAllBtn', 'prefs.group.personal', 'prefs.group.hardware',
  'prefs.group.internet', 'prefs.group.system',
  'prefs.pane.appearance', 'prefs.pane.desktop', 'prefs.pane.datetime',
  'prefs.pane.network', 'prefs.pane.sound', 'prefs.pane.universal',
  'prefs.desktop.tabDesktop', 'prefs.desktop.tabSaver',
  'prefs.display.tabDisplay', 'prefs.sound.effects',
  'prefs.energy.title', 'prefs.datetime.tabDate',
  'prefs.security.banner', 'prefs.spotlight.results',
  'prefs.keyboard.tabKeyboard', 'prefs.net.location',
  'prefs.bt.help', 'prefs.share.file', 'prefs.ua.seeing',
  'prefs.tm.backupNow', 'prefs.update.checkNow', 'prefs.reset.button',
  'help.welcome.title', 'help.welcome.html',
  'app.finder', 'app.sysprefs', 'app.calculator', 'app.mail',
  'dialog.ok', 'dialog.cancel', 'menu.file', 'menu.edit',
];

await initI18n();

for (const locale of ['en', 'zh-CN']) {
  await setLocale(locale, { persist: false, force: true });
  assert.equal(getLocale(), locale);
  for (const key of must) {
    const value = t(key);
    assert.notEqual(value, key, `${locale}: missing key ${key}`);
    assert.ok(String(value).length > 0, `${locale}: empty ${key}`);
    if (locale === 'en') {
      assert.ok(!/[\u4e00-\u9fff]/.test(String(value)), `en key ${key} contains CJK: ${value}`);
      assert.notEqual(String(value).trim(), '…', `en key ${key} is ellipsis-only`);
      assert.notEqual(String(value).trim(), '...', `en key ${key} is ellipsis-only`);
      assert.ok(!/\bt\('u\./.test(String(value)), `en key ${key} leaks t() call`);
      assert.ok(!/<\/?(?:div|span|header|textarea)\b/i.test(String(value)) || key.includes('help.') || key.includes('net.') || key.includes('share.'),
        `en key ${key} unexpected HTML leak: ${String(value).slice(0, 80)}`);
    }
  }
}

// Clock day arrays
setLocale('en', { persist: false, force: true });
const enDays = t('clock.days');
assert.ok(Array.isArray(enDays) && enDays.length === 7, 'en clock.days');
assert.ok(!enDays.some((d) => /[\u4e00-\u9fff]/.test(d)), 'en clock.days CJK-free');
setLocale('zh-CN', { persist: false, force: true });
const zhDays = t('clock.days');
assert.ok(Array.isArray(zhDays) && zhDays.length === 7, 'zh clock.days');

// Catalog poison guards on en.js
const enSrc = readFileSync(join(root, 'js/i18n/locales/en.js'), 'utf8');
const enVals = [...enSrc.matchAll(/:\s*'((?:\\.|[^'\\])*)'/g)].map((m) => m[1]);
const ellipsis = enVals.filter((v) => v.trim() === '…' || v.trim() === '...');
assert.equal(ellipsis.length, 0, `en catalog still has ${ellipsis.length} ellipsis-only values`);
const jsLeaks = enVals.filter((v) => /\bt\('|querySelector|innerHTML\s*=/.test(v));
assert.ok(jsLeaks.length <= 2, `en catalog JS leaks: ${jsLeaks.slice(0, 3)}`); // allow "function keys" phrase
const nestedLeak = enVals.filter((v) => /u\.[a-f0-9]{6,}t\(/.test(v));
assert.equal(nestedLeak.length, 0, 'en catalog must not contain nested t() fragments');

// No nested broken t() patterns in shipped apps/system sources
const scanDirs = ['js/apps', 'js/system'];
const nestedSites = [];
const literalTemplateSites = [];
for (const dir of scanDirs) {
  for (const name of readdirSync(join(root, dir), { withFileTypes: true })) {
    // walk simple: only top-level + one nest for leopard-native stubs
  }
}
function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.js')) {
      const src = readFileSync(p, 'utf8');
      if (/t\('u\.[a-f0-9]+t\(|u\.[a-f0-9]{10}t\(/.test(src)) nestedSites.push(p);
      if (/^\s*[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\s*=\s*(['"])\$\{t\(/m.test(src)) {
        literalTemplateSites.push(p);
      }
    }
  }
}
walk(join(root, 'js/apps'));
walk(join(root, 'js/system'));
assert.equal(nestedSites.length, 0, `nested t() corruption remains in: ${nestedSites.join(', ')}`);
assert.equal(
  literalTemplateSites.length,
  0,
  `quoted \${t(...)} assignments render literally in: ${literalTemplateSites.join(', ')}`,
);

// Sysprefs panes reference prefs.pane.* keys
const sysprefs = readFileSync(join(root, 'js/apps/sysprefs.js'), 'utf8');
for (const id of ['exposespaces', 'security', 'spotlight', 'network', 'bluetooth', 'universal']) {
  assert.ok(sysprefs.includes(`prefs.pane.${id}`), `sysprefs missing prefs.pane.${id}`);
}
assert.ok(sysprefs.includes("t('prefs.desktop.tabDesktop')"), 'desktop tab i18n');
assert.ok(sysprefs.includes("t('prefs.datetime.tabDate')"), 'datetime tab i18n');
assert.ok(sysprefs.includes("t('prefs.sound.effects')"), 'sound tab i18n');
assert.ok(sysprefs.includes("t('prefs.display.tabDisplay')"), 'display tab i18n');

// Menubar chrome
const index = readFileSync(join(root, 'index.html'), 'utf8');
assert.ok(index.includes('menubar.volume'), 'volume i18n');
const shell = readFileSync(join(root, 'js/system/shell.js'), 'utf8');
assert.ok(shell.includes("t('menubar.mute')"), 'mute title i18n');
assert.ok(shell.includes("t('desktop.newFolder')") || shell.includes("t('ui."), 'desktop context menu i18n');
assert.ok(shell.includes("t('clock.use24h')"), 'clock menu i18n');

// Calculator paper tape template must be well-formed (not missing textarea open)
const calc = readFileSync(join(root, 'js/apps/calculator.js'), 'utf8');
assert.ok(calc.includes('<textarea'), 'calculator paper tape has textarea');
assert.ok(!/t\('u\.[a-f0-9]+t\(/.test(calc), 'calculator has no nested t()');
assert.ok(calc.includes('tape-clear') || calc.includes('tape-recalculate') || calc.includes('calculator-tape'), 'calculator tape chrome present');

// Mail module (split from the old leopard-native monolith) must be intact
const mailHost = readFileSync(join(root, 'js/apps/mail.js'), 'utf8');
assert.ok(mailHost.includes("id:'mail'") || mailHost.includes('id:"mail"') || mailHost.includes("id: 'mail'"), 'mail app registered');
assert.ok(!/t\('u\.[a-f0-9]+t\(/.test(mailHost), 'mail module has no nested t()');
assert.ok(mailHost.includes('mail-row') || mailHost.includes('composeMail') || mailHost.includes('MAIL_KEY'), 'mail UI builders present');


// Fullwidth CJK punctuation and HTML leaks must not appear in en string values
const fwPunct = enVals.filter((v) => /[\u3000-\u303f\uff00-\uffef]/.test(v));
assert.equal(fwPunct.length, 0, `en catalog still has ${fwPunct.length} fullwidth-punctuation values`);
const htmlLeaks = enVals.filter((v) => /<\/?(?:div|span|header|textarea|button|option)\b/i.test(v));
assert.equal(htmlLeaks.length, 0, `en catalog HTML leaks: ${htmlLeaks.slice(0, 3)}`);

// Calculator primary UI: paper tape + no CJK in calculator.js source UI path
const calcCjk = [...calc.matchAll(/[\u4e00-\u9fff]/g)];
assert.equal(calcCjk.length, 0, `calculator.js still has ${calcCjk.length} CJK characters`);
assert.ok(calc.includes("t('calc.") || calc.includes("t('ui.7f6102c06772')"), 'calculator uses i18n keys for tape/units');

// Catalog must pair en/zh key sets
const zhSrc = readFileSync(join(root, 'js/i18n/locales/zh-CN.js'), 'utf8');
const enKeys = new Set([...enSrc.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]));
const zhKeys = new Set([...zhSrc.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]));
for (const k of enKeys) assert.ok(zhKeys.has(k), `zh missing key ${k}`);
for (const k of zhKeys) assert.ok(enKeys.has(k), `en missing key ${k}`);

console.log('i18n-prefs-chrome-contract: OK');
