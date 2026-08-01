import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function loadRegistryInstall() {
  const filename = resolve(projectRoot, 'js/system/registry.js');
  const source = readFileSync(filename, 'utf8')
    .replace(/^import[^\n]*\n/gm, '')
    .replace('export function install', 'function install');
  const document = {
    documentElement: { lang: 'zh-CN' },
    dispatchEvent() {},
  };
  class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  }
  return Function(
    't', 'document', 'CustomEvent', 'console',
    `"use strict";\n${source}\nreturn install;`,
  )((key) => key, document, CustomEvent, { error() {}, warn() {}, log() {} });
}

function makeSystem() {
  const opens = [];
  const alerts = [];
  const recents = [];
  let busy = 0;
  const sys = {
    apps: {},
    $: () => null,
    beginBusy: () => { busy += 1; return () => { busy -= 1; }; },
    addRecentApp: (id) => recents.push(id),
    syslog() {},
    updateDock() {},
    setActiveApp() {},
    showApp() {},
    focusWindow() {},
    alertBox: (title, message) => alerts.push({ title, message }),
  };
  loadRegistryInstall()(sys);
  return { sys, opens, alerts, recents, get busy() { return busy; } };
}

test('concurrent lazy launches import once and the newest launch argument wins', async () => {
  const harness = makeSystem();
  const { sys, opens } = harness;
  let importCount = 0;
  const attempts = [];
  let completeImport;

  sys.registerLazyApp({ id:'preferences', name:'Preferences', icon:'gear' }, (attempt) => {
    importCount += 1;
    attempts.push(attempt);
    return new Promise((resolveImport) => {
      completeImport = () => {
        sys.registerApp({
          id:'preferences', name:'Preferences', icon:'gear',
          open:(arg) => opens.push(arg),
        });
        resolveImport();
      };
    });
  });

  const first = sys.launch('preferences', { pane:'desktop' });
  const second = sys.launch('preferences', { pane:'network' });
  assert.strictEqual(first, second, 'concurrent calls must share one launch promise');
  await Promise.resolve();
  assert.equal(importCount, 1);
  assert.deepEqual(attempts, [1]);
  completeImport();
  assert.equal(await first, true);
  assert.deepEqual(opens, [{ pane:'network' }]);
  assert.equal(harness.busy, 0);
});

test('loaded descriptors retain identity, windows, hidden state, and private runtime state', () => {
  const { sys } = makeSystem();
  const placeholder = sys.registerLazyApp(
    { id:'preferences', name:'Preferences', icon:'gear' },
    async () => {},
  );
  const windows = [{ id:'existing-window' }];
  placeholder.windows = windows;
  placeholder.hidden = true;
  placeholder._preferencesWindow = windows[0];

  const loaded = sys.registerApp({
    id:'preferences', name:'System Preferences', icon:'gear', open() {},
  });
  assert.strictEqual(loaded, placeholder, 'Dock/Finder descriptor references must stay live');
  assert.strictEqual(loaded.windows, windows);
  assert.equal(loaded.hidden, true);
  assert.strictEqual(loaded._preferencesWindow, windows[0]);
  assert.equal(loaded._lazyState.loaded, true);
  assert.equal(loaded._lazyPlaceholder, undefined);
});

test('a failed lazy load alerts once, resets its promise, and succeeds on retry', async () => {
  const harness = makeSystem();
  const { sys, opens, alerts } = harness;
  let attempts = 0;
  const loaderAttempts = [];
  sys.registerLazyApp({ id:'preferences', name:'Preferences', icon:'gear' }, async (attempt) => {
    attempts += 1;
    loaderAttempts.push(attempt);
    if (attempt === 1) throw new Error('temporary chunk failure');
    sys.registerApp({
      id:'preferences', name:'Preferences', icon:'gear',
      open:(arg) => opens.push(arg),
    });
  });

  assert.equal(await sys.launch('preferences', { pane:'sound' }), false);
  assert.equal(attempts, 1);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].message, /加载失败/);
  assert.equal(sys.apps.preferences._lazyState.loadPromise, null);
  assert.equal(harness.busy, 0);

  assert.equal(await sys.launch('preferences', { pane:'keyboard' }), true);
  assert.equal(attempts, 2);
  assert.deepEqual(loaderAttempts, [1, 2]);
  assert.deepEqual(opens, [{ pane:'keyboard' }]);
  assert.equal(alerts.length, 1);
  assert.equal(harness.busy, 0);
});

function collectStaticModuleGraph(entry) {
  const seen = new Set();
  const visit = (filename) => {
    filename = resolve(filename);
    if (seen.has(filename)) return;
    seen.add(filename);
    const source = readFileSync(filename, 'utf8');
    for (const match of source.matchAll(/^\s*import\s+([\s\S]*?);/gm)) {
      const statement = match[1].trim();
      if (statement.startsWith('(')) continue;
      const specifier = statement.match(/(?:from\s*)?['"]([^'"]+)['"]\s*$/)?.[1];
      if (!specifier?.startsWith('.')) continue;
      const target = resolve(dirname(filename), specifier);
      visit(target);
    }
  };
  visit(entry);
  return seen;
}

test('System Preferences stays visible but is absent from the eager app module graph', () => {
  const appIndex = resolve(projectRoot, 'js/apps/index.js');
  const graph = collectStaticModuleGraph(appIndex);
  const preferences = resolve(projectRoot, 'js/apps/sysprefs.js');
  const source = readFileSync(appIndex, 'utf8');

  assert.equal(graph.has(preferences), false, 'sysprefs.js must not be statically reachable');
  assert.match(source, /registerLazyApp\s*\(/);
  assert.match(source, /ICONS\.sysprefs/);
  assert.match(source, /attempt\s*===\s*1\s*\?\s*import\(['"]\.\/sysprefs\.js['"]\)/);
  assert.match(source, /import\(`\.\/sysprefs\.js\?retry=\$\{attempt\}`\)/);
});

test('the eager preference runtime preserves global timers without duplicate UI installation', () => {
  const appIndex = readFileSync(resolve(projectRoot, 'js/apps/index.js'), 'utf8');
  const preferences = readFileSync(resolve(projectRoot, 'js/apps/sysprefs.js'), 'utf8');
  const runtime = readFileSync(resolve(projectRoot, 'js/apps/preferences-runtime.js'), 'utf8');

  assert.match(appIndex, /installPreferencesRuntime\(\)/);
  assert.match(runtime, /setInterval\(checkEnergySchedule,\s*15000\)/);
  assert.match(runtime, /screensaver-preferences-changed/);
  assert.doesNotMatch(preferences, /^\s*installScreenSaverRuntime\(\);\s*$/m);
  assert.doesNotMatch(preferences, /^\s*installEnergyScheduleRuntime\(\);\s*$/m);
});

test('preference background services install eagerly and exactly once without opening the pane', () => {
  const source = readFileSync(resolve(projectRoot, 'js/apps/preferences-runtime.js'), 'utf8')
    .replace(/^import[^\n]*\n/gm, '')
    .replaceAll('export function', 'function');
  const appended = [];
  const listeners = [];
  const timeouts = [];
  const intervals = [];
  const document = {
    querySelector:() => null,
    createElement:() => ({ setAttribute() {} }),
    body:{ appendChild:(element) => appended.push(element) },
    addEventListener:(type) => listeners.push(`document:${type}`),
  };
  const window = {
    addEventListener:(type) => listeners.push(`window:${type}`),
    removeEventListener() {},
  };
  const api = Function(
    'System', 'Leopard', 't', 'document', 'window', 'performance',
    'localStorage', 'sessionStorage', 'setTimeout', 'clearTimeout',
    'setInterval', 'clearInterval', 'requestAnimationFrame', 'innerWidth', 'innerHeight',
    `"use strict";\n${source}\nreturn { installPreferencesRuntime, refreshPreferencesRuntime };`,
  )(
    { windows:[], launch() {}, minimizeWindow() {}, toggleExpose() {}, confirmBox() {}, shutdownSequence() {} },
    { toast() {} }, (key) => key, document, window, { now:() => 0 },
    { getItem:() => null }, { getItem:() => null, setItem() {} },
    (_fn, delay) => { timeouts.push(delay); return timeouts.length; }, () => {},
    (_fn, delay) => { intervals.push(delay); return intervals.length; }, () => {},
    () => 0, 1280, 800,
  );

  api.installPreferencesRuntime();
  api.installPreferencesRuntime();
  assert.equal(appended.length, 4, 'Hot Corners should exist before the pane opens');
  assert.ok(timeouts.includes(3 * 60000), 'default idle screen saver timer was not armed');
  assert.deepEqual(intervals, [15000], 'Energy Saver polling must be installed only once');
  assert.ok(listeners.includes('window:pointermove'));
  assert.ok(listeners.includes('document:screensaver-preferences-changed'));
  assert.ok(listeners.includes('document:energy-schedule-changed'));
});
