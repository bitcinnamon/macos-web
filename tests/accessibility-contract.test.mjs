import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const menus = readFileSync(new URL('../js/system/menus.js', import.meta.url), 'utf8');
const boot = readFileSync(new URL('../js/system/boot.js', import.meta.url), 'utf8');
const windows = readFileSync(new URL('../js/system/windows.js', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../js/system/shell.js', import.meta.url), 'utf8');
const aqua = readFileSync(new URL('../css/aqua.css', import.meta.url), 'utf8');

assert.match(html, /class="mb-left" role="menubar"/);
assert.match(html, /class="mb-right" role="toolbar"/);
assert.match(html, /mb-apple[^>]+role="menuitem"[^>]+tabindex="0"/);
assert.match(html, /id="mb-volume"[^>]+role="button"[^>]+tabindex="0"/);
assert.match(html, /id="dock" role="toolbar" aria-label="Dock"/);
assert.match(menus, /menuitemcheckbox/);
assert.match(menus, /aria-haspopup/);
assert.match(menus, /aria-controls/);
assert.match(menus, /\['Enter', ' ', 'ArrowDown'\]/);
assert.match(boot, /keyboardActivate/);
assert.match(aqua, /\.mb-item:focus-visible/);
assert.match(aqua, /\.tl-btn:focus-visible/);
assert.match(windows, /setAttribute\('role', 'dialog'\)/);
assert.match(windows, /setAttribute\('aria-labelledby', title\.id\)/);
assert.match(windows, /t\('window\.minimize'\)/);
assert.match(windows, /button\.click\(\)/);
assert.match(shell, /d\.setAttribute\('aria-label', app\.name\)/);
assert.match(shell, /trash\.setAttribute\('role', 'button'\)/);
assert.match(shell, /d\.setAttribute\('aria-label', it\.label\)/);

console.log('accessibility-contract assertions passed');
