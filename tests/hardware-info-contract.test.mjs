import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const services = readFileSync(new URL('../js/system/services.js', import.meta.url), 'utf8');
const profiler = readFileSync(new URL('../js/apps/sysprofiler.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const enCatalog = readFileSync(new URL('../js/i18n/locales/en.js', import.meta.url), 'utf8');
const zhCatalog = readFileSync(new URL('../js/i18n/locales/zh-CN.js', import.meta.url), 'utf8');

assert.match(services, /navigator\.hardwareConcurrency/);
assert.match(services, /navigator\.deviceMemory/);
assert.match(services, /Apple\\s\+M\\d\+/);
assert.match(services, /info\.processorName = appleChip/);

assert.doesNotMatch(services, /2\.4 GHz Intel Core 2 Duo/);
assert.doesNotMatch(services, /2 GB 667 MHz DDR2 SDRAM/);
assert.doesNotMatch(profiler, /MacBookPro4,1/);
assert.doesNotMatch(profiler, /2\.4 GHz/);
assert.doesNotMatch(profiler, /667 MHz DDR2 SDRAM/);

// Row labels may be Chinese literals or t('…') after i18n wiring.
assert.match(profiler, /HW\.processorName/);
assert.match(profiler, /HW\.processor/);
assert.match(profiler, /HW\.memory/);
assert.match(profiler, /HW\.gpu/);
assert.match(profiler, /VFS\.storageStatus/);
assert.match(profiler, /state\.estimatedBytes/);
assert.doesNotMatch(profiler, /JSON\.stringify\(localStorage\)/);
assert.doesNotMatch(enCatalog, /HFS\+ \(localStorage/);
assert.doesNotMatch(zhCatalog, /HFS\+.*localStorage/);
assert.ok(
  /处理器名称|processorName|prefs\.|t\('u\./.test(profiler),
  'profiler still exposes processor name field wiring',
);
assert.match(index, /type="module"/);
assert.match(index, /js\/main\.js/);

// Live hardware detector still builds real browser-facing fields.
const hardwareStart = services.indexOf('sys.HW = (() => {');
const hardwareEnd = services.indexOf('\n\n  sys.uptimeStr', hardwareStart);
assert.ok(hardwareStart >= 0 && hardwareEnd > hardwareStart, 'hardware detector block was not found');
const hardwareBlock = services
  .slice(hardwareStart, hardwareEnd)
  .replace('sys.HW =', 'globalThis.HW =');

const unmaskedRenderer = 0x9246;
const gl = {
  VERSION: 0x1f02,
  SHADING_LANGUAGE_VERSION: 0x8b8c,
  RENDERER: 0x1f01,
  getExtension: (name) => (name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: unmaskedRenderer } : null),
  getParameter: (param) => {
    if (param === unmaskedRenderer) return 'ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)';
    if (param === gl.VERSION) return 'WebGL 2.0';
    if (param === gl.SHADING_LANGUAGE_VERSION) return 'WebGL GLSL ES 3.00';
    if (param === gl.RENDERER) return 'WebKit WebGL';
    return null;
  },
};

const document = {
  createElement: () => ({
    getContext: (type) => (type === 'webgl2' ? gl : null),
  }),
};

const sandbox = {
  navigator: {
    hardwareConcurrency: 12,
    deviceMemory: 32,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    platform: 'MacIntel',
    language: 'zh-CN',
    userAgentData: { platform: 'macOS', model: '' },
  },
  screen: { width: 1512, height: 982, colorDepth: 30 },
  devicePixelRatio: 2,
  document,
  Math,
  String,
  Number,
  Object,
  Array,
  // Hardware detector may call t() for localized capability labels.
  t: (key) => key,
  globalThis: {},
};
sandbox.globalThis = sandbox;

const vm = await import('node:vm');
vm.runInNewContext(`${hardwareBlock}\nglobalThis.__hw = HW;`, sandbox, { filename: 'hardware.js' });
const HW = sandbox.__hw;

assert.equal(HW.cores, 12);
assert.equal(HW.memory, '32 GB');
assert.match(HW.processorName, /Apple M2 Pro/);
assert.match(HW.processor, /Apple M2 Pro/);
assert.equal(HW.webgl2, true);
assert.equal(HW.graphicsApi, 'WebGL 2.0');

console.log('Dynamic host hardware information contract assertions passed');
