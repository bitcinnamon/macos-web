import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../js/system/index.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const required = [
  'registerApp', 'registerLazyApp', 'launch', 'createWindow', 'closeWindow', 'minimizeWindow', 'focusWindow',
  'boot', 'alertBox', 'quitApp', 'el', 'syslog', 'HW', 'Kexts', 'toggleExpose',
  'contextMenu', 'moveToTrash', 'emptyTrash', 'confirmBox', 'showSheet', 'openPanel', 'savePanel',
  'getFinderPreferences', 'getAppPreferences', 'beginBusy',
];

for (const key of required) {
  assert.match(index, new RegExp(`\\b${key}\\b`), `System API missing ${key}`);
}

assert.match(html, /type="module"/);
assert.match(html, /js\/main\.js/);
assert.doesNotMatch(html, /<script src="js\/system\.js/);
assert.match(main, /System\.boot\(\)/);
assert.match(main, /Leopard\.init\(\)/);

// Subsystems exist (no single 5k-line system.js monolith).
for (const part of ['prefs', 'services', 'registry', 'windows', 'menus', 'dialogs', 'shell', 'boot']) {
  assert.ok(
    readFileSync(new URL(`../js/system/${part}.js`, import.meta.url), 'utf8').length > 100,
    `missing system/${part}.js`,
  );
}

console.log('system-api-contract assertions passed');
