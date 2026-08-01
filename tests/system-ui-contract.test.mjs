import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const aqua = readFileSync(new URL('../css/aqua.css', import.meta.url), 'utf8');
const dialogs = readFileSync(new URL('../js/system/dialogs.js', import.meta.url), 'utf8');
const menus = readFileSync(new URL('../js/system/menus.js', import.meta.url), 'utf8');

assert.doesNotMatch(index, /boot-progress|boot-text/);
assert.doesNotMatch(aqua, /#boot-progress|\.boot-text/);
assert.match(index, /type="module"/);
assert.match(index, /js\/main\.js\?v=\d+/);

assert.match(menus, /onOK: sys\.kernelPanicSequence/);
assert.match(menus, /menu\.logOutOk|menu\.logOut/);
assert.match(dialogs, /sys\.kernelPanicSequence = function kernelPanicSequence/);
assert.match(aqua, /\.kernel-panic-screen\.on/);
for (const language of ['en', 'fr', 'de', 'ja']) {
  assert.match(dialogs, new RegExp(`lang="${language}"`));
}

console.log('Boot and four-language kernel panic contract assertions passed');
