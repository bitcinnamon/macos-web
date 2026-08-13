#!/usr/bin/env node

// Static audit for unescaped interpolation into HTML sinks. It is a heuristic
// net, not a proof: it flags `${...}` interpolations that are not wrapped in a
// shared escape/sanitize helper and reference a user/file text field.
//
//   node scripts/check-html-escaping.mjs            # report only, exit 0
//   node scripts/check-html-escaping.mjs --strict   # fail on findings
//   node scripts/check-html-escaping.mjs --verbose  # also print safe/trusted

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');
const VERBOSE = process.argv.includes('--verbose');

const ESCAPE_HELPERS = /^(esc|escapeHtml|helpEscape|html|attr|safeHtml|sanitizeRichText|textToHtml)\s*\(/;

// Deny-list of user/file text fields. Numbers, booleans, ternaries producing
// literal/t() output, icons and formatters are ignored; only these raise a
// finding when interpolated into a sink without an escape helper.
const DANGEROUS_PROP = /\.(name|title|body|subject|content|text|note|notes|comment|location|from|to|address|company|phone|email|label|query)\b/;

function classify(expr) {
  const value = expr.trim();
  if (!value) return { kind: 'safe', why: 'empty' };
  if (ESCAPE_HELPERS.test(value)) return { kind: 'safe', why: 'escape helper' };
  if (/^sys\.helpEscape\s*\(/.test(value)) return { kind: 'safe', why: 'escape helper' };
  if (/^t\s*\(/.test(value)) return { kind: 'safe', why: 'i18n' };
  if (/^messages\s*\[/.test(value)) return { kind: 'safe', why: 'i18n catalog lookup' };
  // Structural expressions (nested template literals or map/join over parts)
  // are scanned recursively, so their child interpolations are checked on their
  // own and this outer expression is not itself a data leak.
  if (value.includes('`') || /\.(map|join)\s*\(/.test(value)) return { kind: 'safe', why: 'structural' };
  // A ternary whose both branches are quoted literals only injects a literal
  // (e.g. `${cond ? 'mine' : ''}`) even when the condition reads a data field.
  if (/^[^`?]*\?\s*['"][^'"]*['"]\s*:\s*['"][^'"]*['"]$/.test(value)) return { kind: 'safe', why: 'literal ternary' };
  if (DANGEROUS_PROP.test(value)) return { kind: 'suspicious', why: 'unescaped data-like property' };
  return { kind: 'safe', why: 'non-data' };
}

// Scan a template literal starting at openIdx (the backtick). Returns the index
// one past the closing backtick and appends every interpolation — including
// those inside nested template literals — to `out` as { expr, at }.
function scanTemplate(src, openIdx, out) {
  let i = openIdx + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '`') return i + 1;
    if (ch === '$' && src[i + 1] === '{') {
      i = scanExpr(src, i + 2, out);
      continue;
    }
    i++;
  }
  return src.length;
}

function scanExpr(src, start, out) {
  let i = start;
  let depth = 1;
  let quote = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
    if (ch === '`') { i = scanTemplate(src, i, out); continue; }
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        out.push({ expr: src.slice(start, i), at: start });
        return i + 1;
      }
      i++;
      continue;
    }
    i++;
  }
  return src.length;
}

// Walk a source range and collect every template literal (skipping strings).
// This covers both `x.innerHTML = \`...\`` and expression right-hand sides like
// `x.innerHTML = items.map((i) => \`...\`).join('')`.
function scanTemplatesInRange(src, from, to, out) {
  let i = from;
  while (i < to) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '`') { i = scanTemplate(src, i, out); continue; }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < to && src[i] !== quote) { if (src[i] === '\\') i++; i++; }
      i++;
      continue;
    }
    i++;
  }
}

function lineEnd(src, index) {
  const end = src.indexOf('\n', index);
  return end < 0 ? src.length : end;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

const findings = [];
let sinks = 0;
let interpolations = 0;

function record(file, short, source, collected) {
  for (const item of collected) {
    interpolations++;
    const result = classify(item.expr);
    if (result.kind === 'suspicious') {
      findings.push({ file: short, line: lineOf(source, item.at), expr: item.expr });
    } else if (VERBOSE) {
      process.stdout.write(`  ${result.kind.padEnd(9)} ${short}:${lineOf(source, item.at)}  ${item.expr}\n`);
    }
  }
}

for (const file of walk(join(root, 'js')).sort()) {
  const source = readFileSync(file, 'utf8');
  const short = relative(root, file);

  // Property assignments: .innerHTML = ... / .outerHTML = ...
  for (const match of source.matchAll(/\.(innerHTML|outerHTML)\s*=\s*/g)) {
    const collected = [];
    scanTemplatesInRange(source, match.index + match[0].length, lineEnd(source, match.index), collected);
    sinks++;
    record(file, short, source, collected);
  }

  // Method calls: .insertAdjacentHTML('...', ...)
  for (const match of source.matchAll(/\.insertAdjacentHTML\s*\(/g)) {
    const collected = [];
    scanTemplatesInRange(source, match.index, lineEnd(source, match.index), collected);
    sinks++;
    record(file, short, source, collected);
  }
}

console.log(`HTML escaping audit: ${sinks} sink(s), ${interpolations} interpolation(s), ${findings.length} suspicious`);
if (findings.length) {
  console.error('\nSuspicious unescaped interpolations:');
  findings.forEach((finding) => {
    console.error(`  ${finding.file}:${finding.line}  \${${finding.expr}}`);
  });
}
if (STRICT && findings.length) {
  console.error('\nhtml-escaping audit failed');
  process.exitCode = 1;
} else {
  console.log('html-escaping audit OK');
}
