#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as vm from 'node:vm';

const { SourceTextModule } = vm;

if (typeof SourceTextModule !== 'function') {
  console.error(
    'SourceTextModule is unavailable. Run this checker with --experimental-vm-modules.',
  );
  process.exit(2);
}

function collectJavaScriptFiles(target, files) {
  const absolute = resolve(target);
  const stats = statSync(absolute);

  if (stats.isDirectory()) {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        collectJavaScriptFiles(resolve(absolute, entry.name), files);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(resolve(absolute, entry.name));
      }
    }
    return;
  }

  if (stats.isFile() && absolute.endsWith('.js')) {
    files.push(absolute);
    return;
  }

  throw new Error(`Not a JavaScript file or directory: ${target}`);
}

const targets = process.argv.slice(2);
const files = [];

for (const target of targets.length ? targets : ['js']) {
  collectJavaScriptFiles(target, files);
}

const uniqueFiles = [...new Set(files)].sort();
let failures = 0;

for (const file of uniqueFiles) {
  try {
    const source = readFileSync(file, 'utf8');
    new SourceTextModule(source, { identifier: pathToFileURL(file).href });
  } catch (error) {
    failures += 1;
    console.error(`\n${file}`);
    console.error(error?.stack || error);
  }
}

if (failures) {
  console.error(`\nESM syntax failed: ${failures} of ${uniqueFiles.length} file(s).`);
  process.exit(1);
}

console.log(`ESM syntax OK (${uniqueFiles.length} file(s)).`);
