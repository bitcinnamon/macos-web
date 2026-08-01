import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const system = readFileSync(new URL('../js/system.js', import.meta.url), 'utf8');
const profiler = readFileSync(new URL('../js/apps/sysprofiler.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(system, /navigator\.hardwareConcurrency/);
assert.match(system, /navigator\.deviceMemory/);
assert.match(system, /Apple\\s\+M\\d\+/);
assert.match(system, /info\.processorName = appleChip/);
assert.match(system, /data-about-hw="processor"/);
assert.match(system, /processor\.textContent = HW\.processor/);
assert.match(system, /memory\.textContent = HW\.memory/);

assert.doesNotMatch(system, /2\.4 GHz Intel Core 2 Duo/);
assert.doesNotMatch(system, /2 GB 667 MHz DDR2 SDRAM/);
assert.doesNotMatch(profiler, /MacBookPro4,1/);
assert.doesNotMatch(profiler, /2\.4 GHz/);
assert.doesNotMatch(profiler, /667 MHz DDR2 SDRAM/);

assert.match(profiler, /\['处理器名称', HW\.processorName\]/);
assert.match(profiler, /\['处理器', HW\.processor\]/);
assert.match(profiler, /\['内存', HW\.memory\]/);
assert.match(profiler, /\['图形处理器', HW\.gpu\]/);
assert.match(index, /js\/system\.js\?v=38/);
assert.match(index, /js\/apps\/sysprofiler\.js\?v=16/);

const hardwareStart = system.indexOf('  const HW = (() => {');
const hardwareEnd = system.indexOf('\n\n  function uptimeStr()', hardwareStart);
assert.ok(hardwareStart >= 0 && hardwareEnd > hardwareStart, 'hardware detector block was not found');
const hardwareBlock = system
  .slice(hardwareStart, hardwareEnd)
  .replace('const HW =', 'globalThis.HW =');

const unmaskedRenderer = 0x9246;
const gl = {
  VERSION: 0x1f02,
  SHADING_LANGUAGE_VERSION: 0x8b8c,
  RENDERER: 0x1f01,
  getExtension(name) {
    return name === 'WEBGL_debug_renderer_info'
      ? { UNMASKED_RENDERER_WEBGL:unmaskedRenderer }
      : null;
  },
  getParameter(parameter) {
    if (parameter === unmaskedRenderer) {
      return 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)';
    }
    if (parameter === this.VERSION) return 'WebGL 2.0';
    if (parameter === this.SHADING_LANGUAGE_VERSION) return 'WebGL GLSL ES 3.00';
    if (parameter === this.RENDERER) return 'WebGL GPU';
    return '';
  },
};
const context = vm.createContext({
  devicePixelRatio:2,
  document:{
    createElement:() => ({
      getContext:(kind) => kind === 'webgl2' ? gl : null,
    }),
  },
  navigator:{
    deviceMemory:32,
    hardwareConcurrency:14,
    language:'zh-CN',
    platform:'MacIntel',
    userAgent:'Mozilla/5.0 (Macintosh; Mac OS X 10_15_7)',
    userAgentData:{ platform:'macOS', model:'' },
  },
  screen:{ width:3024, height:1964, colorDepth:30 },
});
vm.runInContext(hardwareBlock, context, { filename:'system-hardware-detector.js' });
assert.equal(context.HW.processorName, 'Apple M4 Pro');
assert.equal(context.HW.processor, 'Apple M4 Pro（14 核）');
assert.equal(context.HW.memory, '32 GB');
assert.equal(context.HW.model, 'Mac');
assert.equal(context.HW.gpu.includes('Apple M4 Pro'), true);

console.log('Dynamic host hardware information contract assertions passed');
