import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const checker = fileURLToPath(new URL('../scripts/check-esm.mjs', import.meta.url));

function checkModules(...targets) {
  return spawnSync(
    process.execPath,
    ['--no-warnings', '--experimental-vm-modules', checker, ...targets],
    { cwd: projectRoot, encoding: 'utf8' },
  );
}

test('every browser JavaScript file parses as an ES module', () => {
  const result = checkModules('js');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ESM syntax OK/);
});

test('ESM checker rejects malformed modules', () => {
  const directory = mkdtempSync(join(tmpdir(), 'macos-web-esm-'));
  const malformed = join(directory, 'malformed.js');

  try {
    writeFileSync(malformed, 'export const broken = ;\n');
    const result = checkModules(malformed);
    assert.notEqual(result.status, 0, 'malformed module unexpectedly passed');
    assert.match(`${result.stdout}\n${result.stderr}`, /malformed\.js/);
    assert.match(`${result.stdout}\n${result.stderr}`, /SyntaxError|Unexpected token/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
