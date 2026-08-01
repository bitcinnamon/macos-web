import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const windows = readFileSync(new URL('../js/system/windows.js', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../js/system/shell.js', import.meta.url), 'utf8');
const boot = readFileSync(new URL('../js/system/boot.js', import.meta.url), 'utf8');

assert.match(windows, /sys\.clampWindowToViewport\s*=\s*function/);
assert.match(windows, /sys\.clampAllWindowsToViewport\s*=\s*function/);
assert.match(windows, /_viewportAdaptation/);
assert.match(windows, /commitWindowViewportGeometry/);
assert.match(shell, /sys\.clampDesktopIconsToViewport\s*=\s*function/);
assert.doesNotMatch(
  shell.slice(shell.indexOf('sys.clampDesktopIconsToViewport'), shell.indexOf('sys.handleViewportResize')),
  /localStorage\.setItem/,
  'viewport-only desktop clamping must not overwrite the saved user position',
);
assert.match(shell, /sys\.handleViewportResize\s*=\s*function/);
assert.match(shell, /sys\.installViewportResizeRuntime\s*=\s*function/);
assert.match(boot, /installViewportResizeRuntime/);

console.log('viewport-clamp-contract assertions passed');
