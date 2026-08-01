import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsRoot = path.join(root, 'js');

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes:true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolute) : entry.name.endsWith('.js') ? [absolute] : [];
  });
}

test('active runtime has no retired hard-coded HOME paths', () => {
  const offenders = filesBelow(jsRoot)
    .filter((file) => !file.includes(`${path.sep}i18n${path.sep}`))
    .filter((file) => file !== path.join(jsRoot, 'config.js'))
    .flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return /\/用户\/roll|\/Users\/roll/.test(source) ? [path.relative(root, file)] : [];
    });
  assert.deepEqual(offenders, [], `retired HOME paths remain in: ${offenders.join(', ')}`);
});

test('file-producing apps use configured path constants', () => {
  const native = fs.readFileSync(path.join(jsRoot, 'apps/leopard-native.js'), 'utf8');
  const preferences = fs.readFileSync(path.join(jsRoot, 'apps/sysprefs.js'), 'utf8');
  const finder = fs.readFileSync(path.join(jsRoot, 'apps/finder-leopard.js'), 'utf8');

  assert.match(native, /const DESKTOP=paths\.desktop/);
  assert.match(native, /const PHOTO_DIR=`\$\{paths\.pictures\}\/Photo Booth`/);
  assert.match(native, /VFS\.putNode\(`\$\{paths\.documents\}\/\$\{name\}`/);
  assert.match(preferences, /VFS\.uniqueName\(paths\.downloads/);
  assert.match(preferences, /VFS\.putNode\(`\$\{paths\.downloads\}\/\$\{name\}`/);
  assert.match(finder, /path:paths\.home, label:HOME_USER/);
});

test('Finder toolbar translations are evaluated rather than shown as source text', () => {
  const finder = fs.readFileSync(path.join(jsRoot, 'apps/finder-leopard.js'), 'utf8');
  assert.doesNotMatch(finder, /(?:title|placeholder)="\$\{t\(/);
  assert.match(finder, /back\.title=t\(/);
  assert.match(finder, /search\.placeholder=t\(/);
});
