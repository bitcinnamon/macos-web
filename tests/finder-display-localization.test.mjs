import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureLocale, setLocale } from '../js/i18n/index.js';
import { paths } from '../js/config.js';
import {
  finderDisplayName, finderDisplayPath, finderSidebarRoute,
  finderVisibleChildren,
} from '../js/finder-display.js';

await ensureLocale('en');
await ensureLocale('zh-CN');

test('well-known VFS paths localize without changing their physical identity', async () => {
  await setLocale('en', { persist:false, force:true });
  assert.equal(finderDisplayName('/应用程序', { type:'dir' }), 'Applications');
  assert.equal(finderDisplayName('/应用程序/实用工具', { type:'dir' }), 'Utilities');
  assert.equal(finderDisplayName('/资料库', { type:'dir' }), 'Library');
  assert.equal(finderDisplayName('/系统', { type:'dir' }), 'System');
  assert.equal(finderDisplayName(paths.documents, { type:'dir' }), 'Documents');
  assert.equal(finderDisplayPath(`${paths.documents}/Report.txt`), `/Users/macosx/Documents/Report.txt`);

  await setLocale('zh-CN', { persist:false, force:true });
  assert.equal(finderDisplayName('/应用程序', { type:'dir' }), '应用程序');
  assert.equal(finderDisplayName(paths.documents, { type:'dir' }), '文稿');
  assert.equal(finderDisplayPath(`${paths.documents}/Report.txt`), `/用户/macosx/文稿/Report.txt`);
});

test('managed apps use appId labels while ordinary user names remain verbatim', async () => {
  await setLocale('en', { persist:false, force:true });
  const appNames = {
    sysprefs:'System Preferences', sysprofiler:'System Profiler',
    calculator:'Calculator', terminal:'Terminal',
  };
  const resolve = (appId) => appNames[appId] || '';
  assert.equal(finderDisplayName('/应用程序/系统偏好设置.app', { type:'app', appId:'sysprefs' }, resolve), 'System Preferences');
  assert.equal(finderDisplayName('/应用程序/实用工具/系统报告.app', { type:'app', appId:'sysprofiler' }, resolve), 'System Profiler');
  assert.equal(finderDisplayName('/应用程序/计算器.app', { type:'app', appId:'calculator' }, resolve), 'Calculator');
  assert.equal(finderDisplayName('/应用程序/终端.app', { type:'app', appId:'terminal' }, resolve), 'Terminal');
  assert.equal(finderDisplayName(`${paths.documents}/应用程序.txt`, { type:'file' }, resolve), '应用程序.txt');
  assert.equal(finderDisplayName(`${paths.documents}/系统偏好设置.app`, { type:'file' }, resolve), '系统偏好设置.app');
  assert.equal(finderDisplayName(`${paths.documents}/Unknown.app`, { type:'app', appId:'unknown' }, resolve), 'Unknown');
});

test('home projection is non-destructive and managed app duplicates collapse only by appId', () => {
  const rawHome = [paths.desktop, paths.documents, paths.public, paths.sites];
  const homeRows = finderVisibleChildren(paths.home, rawHome, () => ({ type:'dir' }));
  assert.ok(homeRows.includes('/应用程序'));
  assert.ok(!homeRows.includes(paths.public));
  assert.deepEqual(rawHome, [paths.desktop, paths.documents, paths.public, paths.sites], 'backing VFS list was mutated');

  const rows = [
    '/应用程序/计算器.app', '/应用程序/Calculator.app',
    '/应用程序/计算器.txt', '/应用程序/Calculator.txt',
  ];
  const nodes = new Map([
    [rows[0], { type:'app', appId:'calculator' }],
    [rows[1], { type:'app', appId:'calculator' }],
    [rows[2], { type:'file' }],
    [rows[3], { type:'file' }],
  ]);
  assert.deepEqual(finderVisibleChildren('/应用程序', rows, (path) => nodes.get(path)), [
    '/应用程序/计算器.app', '/应用程序/计算器.txt', '/应用程序/Calculator.txt',
  ]);
});

test('sidebar selection is derived from physical paths and ambiguous logical routes stay explicit', () => {
  assert.equal(finderSidebarRoute('/'), 'device:hard-disk');
  assert.equal(finderSidebarRoute('/应用程序'), 'place:applications');
  assert.equal(finderSidebarRoute('/应用程序/实用工具'), 'place:applications');
  assert.equal(finderSidebarRoute(paths.documents), 'place:documents');
  assert.equal(finderSidebarRoute(paths.public), '', 'physical Public must not impersonate Shared or Bonjour');
});
