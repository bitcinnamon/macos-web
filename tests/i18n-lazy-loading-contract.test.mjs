import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const i18nSource = readFileSync(join(root, 'js/i18n/index.js'), 'utf8');
const mainSource = readFileSync(join(root, 'js/main.js'), 'utf8');

assert.ok(!/^\s*import\s+.+from\s+['"]\.\/locales\//m.test(i18nSource), 'i18n entry must not statically import catalogs');
assert.ok(i18nSource.includes("() => import('./locales/en.js')"), 'English catalog is dynamically loadable');
assert.ok(i18nSource.includes("() => import('./locales/zh-CN.js')"), 'Chinese catalog is dynamically loadable');
assert.ok(mainSource.includes('await initI18n()'), 'entry waits for selected locale before boot');
assert.ok(!/^\s*import\s+['"]\.\/apps\/index\.js['"]/m.test(mainSource), 'apps are not statically evaluated before locale initialization');

const initializedAt = mainSource.indexOf('await initI18n()');
const appsAt = mainSource.indexOf("await import('./apps/index.js')");
assert.ok(initializedAt >= 0 && appsAt > initializedAt, 'application modules load after locale initialization');

console.log('i18n-lazy-loading-contract: OK');
