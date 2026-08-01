import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const aqua = readFileSync(new URL('../css/aqua.css', import.meta.url), 'utf8');
const system = readFileSync(new URL('../js/system.js', import.meta.url), 'utf8');
const finder = readFileSync(new URL('../js/apps/finder-leopard.js', import.meta.url), 'utf8');

assert.match(index, /js\/apps\/finder-leopard\.js\?v=13/);
assert.match(aqua, /\.menu-dropdown\s*\{[^}]*color:\s*#161616/s);
assert.match(aqua, /\.menu-dropdown \.mi > \.shortcut/);
for (const color of ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']) {
  assert.match(aqua, new RegExp(`data-menu-swatch="${color}"`));
}
assert.match(system, /mi\.dataset\.menuSwatch = String\(it\.swatch\)/);
assert.match(system, /label\.textContent = String\(it\.label \?\? ''\)/);
assert.match(finder, /label:entry\.name,\s*swatch:entry\.id/);

console.log('Nested menu color and Finder label swatch contract assertions passed');
