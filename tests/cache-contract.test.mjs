import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

assert.match(worker, /searchParams\.get\('v'\)/);
assert.match(worker, /leopard-web-\$\{VERSION\}/);
assert.match(worker, /caches\.keys\(\)/);
assert.match(worker, /key !== CACHE/);
assert.match(worker, /target\.origin !== self\.location\.origin/);
assert.match(worker, /networkFirst\(request\)/);
assert.doesNotMatch(worker, /cacheFirst/);
assert.match(main, /addEventListener\('leopard-ready'/);
assert.match(main, /serviceWorker\.register\(`\.\/sw\.js\?v=\$\{CACHE_VERSION\}`/);

console.log('cache-contract assertions passed');
