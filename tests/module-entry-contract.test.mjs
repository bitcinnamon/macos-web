import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /<script type="module" src="js\/main\.js\?v=\d+"><\/script>/);
assert.match(html, /css\/aqua\.css\?v=\d+/);
assert.match(html, /css\/apps\.css\?v=\d+/);
assert.match(html, /css\/leopard\.css\?v=\d+/);

// App modules should import System rather than rely on classic script order.
const apps = readdirSync(new URL('../js/apps', import.meta.url))
  .filter((name) => name.endsWith('.js') && name !== 'index.js');
for (const name of apps) {
  const source = readFileSync(new URL(`../js/apps/${name}`, import.meta.url), 'utf8');
  if (name === 'leopard-native.js') {
    const direct = /import\s*\{[^}]*System/.test(source);
    assert.ok(direct, 'leopard-native.js should import System');
    continue;
  }
  assert.match(source, /import\s*\{[^}]*System/, `${name} should import System`);
}

console.log('module-entry-contract assertions passed');
