#!/usr/bin/env node

// Deterministic catalog audit. Structural defects and defects reachable from
// shipped t('...') calls fail the check; legacy generated entries that are not
// referenced are reported as cleanup debt instead of being deleted blindly.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../js/i18n/locales/en.js';
import zhCN from '../js/i18n/locales/zh-CN.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogs = { en, 'zh-CN': zhCN };
const JSON_OUTPUT = process.argv.includes('--json');
const STRICT_LEGACY = process.argv.includes('--strict-legacy');

function walkJavaScript(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path !== join(root, 'js/i18n/locales')) walkJavaScript(path, files);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(path);
    }
  }
  return files;
}

function staticTranslationCalls() {
  const calls = new Map();
  const literalTemplateMistakes = [];
  for (const file of walkJavaScript(join(root, 'js')).sort()) {
    const source = readFileSync(file, 'utf8');
    const shortFile = relative(root, file);
    // Includes calls with a vars object; deliberately does not pretend that
    // dynamically constructed keys can be proven by static analysis.
    for (const match of source.matchAll(/\bt\s*\(\s*(['"])([A-Za-z][A-Za-z0-9_.-]*)\1/g)) {
      const key = match[2];
      if (!calls.has(key)) calls.set(key, []);
      calls.get(key).push(shortFile);
    }

    // Catch JavaScript strings such as title="${t('key')}". Interpolation in
    // an ordinary quoted string is rendered literally; template literals and
    // HTML attributes inside template literals are intentionally not matched.
    const patterns = [
      /(?:^|[;\n])\s*[A-Za-z_$][\w$]*(?:\?\.)?(?:\.[A-Za-z_$][\w$]*)*\s*=\s*(['"])\$\{t\([^\n;]+?\}\1/g,
      /(?:^|[,{;\n])\s*[A-Za-z_$][\w$]*\s*:\s*(['"])\$\{t\([^\n,}]+?\}\1/g,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const expressionOffset = match[0].indexOf('${t');
        const line = source.slice(0, match.index + Math.max(0, expressionOffset)).split('\n').length;
        literalTemplateMistakes.push(`${shortFile}:${line}`);
      }
    }
  }
  return { calls, literalTemplateMistakes: [...new Set(literalTemplateMistakes)].sort() };
}

function valueShape(value) {
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function variables(value) {
  if (typeof value !== 'string') return [];
  return [...new Set([...value.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((match) => match[1]))].sort();
}

function looksGenerated(key) {
  return /(?:^|\.)[a-f0-9]{10,12}$/i.test(key);
}

function sourceFragmentReason(value) {
  if (typeof value !== 'string') return null;
  if (/\$\{\s*t\s*\(/.test(value)) return 'literal ${t(...)} expression';
  if (/\bt\(\s*['"](?:ui|u|app|prefs)\./.test(value)) return 'nested t(...) call';
  if (/\b(?:VFS|System)\.(?:mkdir|write|read|move|copy|remove|launch|alertBox)\s*\(/.test(value)) return 'runtime API call';
  if (/\b(?:querySelector|querySelectorAll|addEventListener)\s*\(/.test(value)) return 'DOM API call';
  if (/\b(?:innerHTML|outerHTML|textContent)\s*=/.test(value)) return 'DOM assignment';
  if (/(?:backHidden|backDisabled|nextLabel)\s*:/.test(value)) return 'object-literal fragment';
  if (/\\'\s*(?:aria-label|&&|\?|:)\s*/.test(value)) return 'escaped source expression';
  if (/\]\s*,\s*\[\s*\\?'[A-Za-z]+\\?'/.test(value)) return 'array source fragment';
  return null;
}

const { calls, literalTemplateMistakes } = staticTranslationCalls();
const used = new Set(calls.keys());
const enKeys = Object.keys(en).sort();
const zhKeys = Object.keys(zhCN).sort();
const enSet = new Set(enKeys);
const zhSet = new Set(zhKeys);
const missingInEnglish = zhKeys.filter((key) => !enSet.has(key));
const missingInChinese = enKeys.filter((key) => !zhSet.has(key));
const missingUsed = [...used].sort().filter((key) => !enSet.has(key) || !zhSet.has(key));
const shapeMismatches = [];
const variableMismatches = [];
const sourceFragments = [];

for (const key of enKeys.filter((candidate) => zhSet.has(candidate))) {
  const enShape = valueShape(en[key]);
  const zhShape = valueShape(zhCN[key]);
  if (enShape !== zhShape) {
    shapeMismatches.push({ key, en: enShape, zhCN: zhShape });
    continue;
  }
  const enVars = variables(en[key]);
  const zhVars = variables(zhCN[key]);
  if (enVars.join('\0') !== zhVars.join('\0')) {
    variableMismatches.push({ key, en: enVars, zhCN: zhVars, used: used.has(key) });
  }
}

for (const [locale, catalog] of Object.entries(catalogs)) {
  for (const [key, value] of Object.entries(catalog)) {
    const reason = sourceFragmentReason(value);
    if (reason) sourceFragments.push({ locale, key, reason, used: used.has(key), value: String(value).slice(0, 120) });
  }
}

const usedSourceFragments = sourceFragments.filter((entry) => entry.used);
const usedVariableMismatches = variableMismatches.filter((entry) => entry.used);
const generatedKeys = enKeys.filter(looksGenerated);
const unused = enKeys.filter((key) => !used.has(key));
const unusedGenerated = unused.filter(looksGenerated);
const report = {
  catalogKeys: { en: enKeys.length, zhCN: zhKeys.length },
  staticallyReferencedKeys: used.size,
  generatedKeys: generatedKeys.length,
  unusedKeys: unused.length,
  unusedGeneratedKeys: unusedGenerated.length,
  missingInEnglish,
  missingInChinese,
  missingUsed,
  shapeMismatches,
  variableMismatches,
  sourceFragments,
  usedSourceFragments,
  literalTemplateMistakes,
};

const fatal = [
  ...missingInEnglish.map((key) => `missing in en: ${key}`),
  ...missingInChinese.map((key) => `missing in zh-CN: ${key}`),
  ...missingUsed.map((key) => `referenced key is not paired: ${key}`),
  ...shapeMismatches.map((entry) => `value shape differs: ${entry.key}`),
  ...usedVariableMismatches.map((entry) => `variables differ in used key: ${entry.key}`),
  ...usedSourceFragments.map((entry) => `source fragment in used ${entry.locale} key: ${entry.key}`),
  ...literalTemplateMistakes.map((site) => `quoted \${t(...)} expression: ${site}`),
];
if (STRICT_LEGACY) {
  fatal.push(...sourceFragments.filter((entry) => !entry.used).map((entry) => `legacy source fragment: ${entry.locale}:${entry.key}`));
  fatal.push(...variableMismatches.filter((entry) => !entry.used).map((entry) => `legacy variable mismatch: ${entry.key}`));
}

if (JSON_OUTPUT) {
  console.log(JSON.stringify({ ok: fatal.length === 0, fatal, report }, null, 2));
} else {
  console.log('i18n catalog audit');
  console.log(`  keys: en=${enKeys.length}, zh-CN=${zhKeys.length}, statically referenced=${used.size}`);
  console.log(`  generated/hash keys: ${generatedKeys.length}`);
  console.log(`  not statically referenced: ${unused.length} (${unusedGenerated.length} generated/hash)`);
  console.log(`  legacy source fragments: ${sourceFragments.length} (${usedSourceFragments.length} referenced)`);
  console.log(`  variable mismatches: ${variableMismatches.length} (${usedVariableMismatches.length} referenced)`);
  if (literalTemplateMistakes.length) console.log(`  literal template mistakes: ${literalTemplateMistakes.join(', ')}`);
  if (fatal.length) {
    console.error('\nFatal i18n audit findings:');
    fatal.forEach((item) => console.error(`  - ${item}`));
  }
  if (!fatal.length && (sourceFragments.length || variableMismatches.length)) {
    console.log('  note: unreferenced generated catalog debt is reported, not deleted; use --strict-legacy to fail on it');
  }
}

if (fatal.length) process.exitCode = 1;
