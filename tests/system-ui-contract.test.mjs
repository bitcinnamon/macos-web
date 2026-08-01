import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const aqua = readFileSync(new URL('../css/aqua.css', import.meta.url), 'utf8');
const system = readFileSync(new URL('../js/system.js', import.meta.url), 'utf8');

assert.doesNotMatch(index, /boot-progress|boot-text/);
assert.doesNotMatch(aqua, /#boot-progress|\.boot-text/);
assert.match(index, /css\/aqua\.css\?v=21/);
assert.match(index, /js\/system\.js\?v=38/);

assert.match(system, /okLabel: '注销', onOK: kernelPanicSequence/);
assert.match(system, /function kernelPanicSequence\(\)/);
assert.match(aqua, /\.kernel-panic-screen\.on/);
for (const language of ['en', 'fr', 'de', 'ja']) {
  assert.match(system, new RegExp(`lang="${language}"`));
}

console.log('Boot and four-language kernel panic contract assertions passed');
