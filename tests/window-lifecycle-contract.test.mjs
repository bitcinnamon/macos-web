import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const windows = readFileSync(new URL('../js/system/windows.js', import.meta.url), 'utf8');
const system = readFileSync(new URL('../js/system/index.js', import.meta.url), 'utf8');

for (const api of [
  'windowSignal', 'addWindowCleanup', 'listenWindow', 'setWindowTimeout',
  'setWindowInterval', 'trackWindowMedia', 'trackWindowObjectURL',
]) {
  assert.match(windows, new RegExp(`sys\\.${api}\\s*=`), `missing lifecycle implementation ${api}`);
  assert.match(system, new RegExp(`\\b${api}\\b`), `missing lifecycle facade ${api}`);
}

assert.match(windows, /new AbortController\(\)/);
assert.match(windows, /_resourceController\.abort\(\)/);
assert.match(windows, /_resourceCleanups\.clear\(\)/);
assert.match(windows, /getTracks\(\)\.forEach/);
assert.match(windows, /URL\.revokeObjectURL/);

console.log('window-lifecycle-contract assertions passed');
