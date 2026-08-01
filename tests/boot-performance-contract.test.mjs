import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boot = readFileSync(new URL('../js/system/boot.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/aqua.css', import.meta.url), 'utf8');

assert.match(boot, /prefers-reduced-motion/);
assert.match(boot, /macweb\.boot\.seen/);
assert.match(boot, /returning \? 650 : 1800/);
assert.match(boot, /finishBoot\('user'\)/);
assert.match(boot, /CustomEvent\('leopard-ready'/);
assert.doesNotMatch(boot, /\}, 2800\)/);
assert.match(css, /--boot-fade-duration/);

console.log('boot-performance-contract assertions passed');
