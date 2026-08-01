import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const prefs = readFileSync(new URL('../js/system/prefs.js', import.meta.url), 'utf8');
const dialogs = readFileSync(new URL('../js/system/dialogs.js', import.meta.url), 'utf8');
const safari = readFileSync(new URL('../js/apps/safari.js', import.meta.url), 'utf8');
const systemPreferences = readFileSync(new URL('../js/apps/sysprefs.js', import.meta.url), 'utf8');
const leopard = readFileSync(new URL('../js/leopard.js', import.meta.url), 'utf8');
const textEdit = readFileSync(new URL('../js/apps/textedit.js', import.meta.url), 'utf8');

assert.match(html, /http-equiv="Content-Security-Policy"/);
assert.match(html, /script-src 'self'/);
assert.match(html, /object-src 'none'/);
assert.doesNotMatch(html, /script-src[^;]*'unsafe-inline'/);

assert.match(prefs, /sys\.textEl\s*=/);
const alertBox = dialogs.slice(dialogs.indexOf('sys.alertBox'), dialogs.indexOf('sys.sleepScreen'));
assert.match(alertBox, /sys\.textEl/);
assert.doesNotMatch(alertBox, /innerHTML/);
assert.doesNotMatch(alertBox, /\$\{text\}/);

const player = safari.match(/<div class="bili-player-shell">[\s\S]*?<\/div>/)?.[0] || '';
assert.match(player, /sandbox="allow-scripts allow-same-origin allow-presentation"/);
assert.doesNotMatch(player, /allow-(?:top-navigation|popups)/);

const wallpaperRender = systemPreferences.slice(systemPreferences.indexOf('const renderCategory'), systemPreferences.indexOf('categories.forEach'));
assert.doesNotMatch(wallpaperRender, /innerHTML[^\n]*w\.name/);
assert.match(wallpaperRender, /el\('span', '', w\.name\)/);

const networkAdvanced = systemPreferences.slice(systemPreferences.indexOf('function openNetworkAdvanced'), systemPreferences.indexOf('function openPrintQueue'));
assert.doesNotMatch(networkAdvanced, /value="\$\{advanced\.(?:ip|mask|router)\}"/);
assert.doesNotMatch(networkAdvanced, /advanced\.(?:dns|search)\.map\([^\n]*<button>/);
assert.match(networkAdvanced, /\.net-ip'\)\.value = String\(advanced\.ip/);

const bluetoothTransfer = systemPreferences.slice(systemPreferences.indexOf('function openBluetoothTransfer'), systemPreferences.indexOf('function openBluetoothFilePanel'));
assert.doesNotMatch(bluetoothTransfer, /status\.innerHTML[^\n]*(?:target|name)/);
assert.match(bluetoothTransfer, /status\.replaceChildren/);

const quickLook = leopard.slice(leopard.indexOf('function quickLook'), leopard.indexOf('function renderSpotlight'));
assert.match(quickLook, /sandbox', ''/);
assert.match(quickLook, /default-src 'none'; img-src data: blob:/);
assert.match(quickLook, /referrerPolicy = 'no-referrer'/);

const richTextSanitizer = textEdit.slice(textEdit.indexOf('function sanitizeRichText'), textEdit.indexOf('function open'));
assert.match(richTextSanitizer, /const allowedTags = new Set/);
assert.match(richTextSanitizer, /noopener noreferrer/);
assert.match(richTextSanitizer, /\^data:image/);
assert.doesNotMatch(richTextSanitizer, /https\?:[^\n]*node\.src/);
assert.match(textEdit, /page\.addEventListener\('paste'/);

console.log('security-contract assertions passed');
