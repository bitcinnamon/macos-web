#!/usr/bin/env node

// Remove only generated/hash catalog entries that are not present as a string
// literal anywhere in shipped source. Semantic keys are retained even when
// dormant so intentional public translation contracts remain stable.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../js/i18n/locales/en.js';
import zhCN from '../js/i18n/locales/zh-CN.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const catalogKeys = new Set(Object.keys(en));
const referenced = new Set();
const sourceFiles = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes:true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path !== join(root, 'js/i18n/locales')) walk(path);
    } else if (entry.isFile() && entry.name.endsWith('.js')) sourceFiles.push(path);
  }
}

walk(join(root, 'js'));
sourceFiles.push(join(root, 'index.html'));
const referenceFiles = [
  ...sourceFiles,
  // Named quality contracts intentionally retain a small set of generated
  // compatibility keys even when their old call sites have been retired.
  join(root, 'tests/i18n-en-quality-contract.test.mjs'),
];
for (const file of referenceFiles) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(['"`])([A-Za-z][A-Za-z0-9_.-]+)\1/g)) {
    if (catalogKeys.has(match[2])) referenced.add(match[2]);
  }
}

const generated = (key) => /(?:^|\.)[a-f0-9]{10,12}$/i.test(key);
const removable = new Set([...catalogKeys].filter((key) => generated(key) && !referenced.has(key)));
const dynamicCalls = sourceFiles.flatMap((file) => {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/\bt\s*\(\s*([A-Za-z_$][\w$]*)/g)]
    .map((match) => `${relative(root, file)}:${source.slice(0, match.index).split('\n').length}:${match[1]}`);
});

console.log(`catalog keys: ${catalogKeys.size}`);
console.log(`literal source references: ${referenced.size}`);
console.log(`unused generated entries removable: ${removable.size}`);
if (dynamicCalls.length) console.log(`dynamic t() call sites reviewed: ${dynamicCalls.length}`);

if (write) {
  for (const name of ['en.js', 'zh-CN.js']) {
    const path = join(root, 'js/i18n/locales', name);
    const lines = readFileSync(path, 'utf8').split('\n');
    const next = lines.filter((line) => {
      const match = line.match(/^  '([^']+)':/);
      return !match || !removable.has(match[1]);
    });
    writeFileSync(path, next.join('\n'));
    console.log(`updated ${relative(root, path)}: ${lines.length - next.length} entries removed`);
  }
}

// If this ever stops being true, source construction of catalog keys needs an
// explicit allowlist before pruning can remain a safe maintenance operation.
const allowedDynamicSites = new Set([
  'js/main.js:key',
  'js/i18n/index.js:key',
  'js/system/windows.js:opts',
  'js/system/windows.js:textOrKey',
  'js/system/windows.js:key',
]);
const unexpected = dynamicCalls.filter((site) => {
  const [file, , variable] = site.split(':');
  return !allowedDynamicSites.has(`${file}:${variable}`);
});
if (unexpected.length) {
  console.error('Unexpected dynamic t() call sites:');
  unexpected.forEach((site) => console.error(`  ${site}`));
  process.exitCode = 1;
}
