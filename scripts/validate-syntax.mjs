#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build']);
const TARGET_EXTENSIONS = ['.gs', '.js', '.html', '.script.html'];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function extractScriptBlocks(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    const attrs = String(match[1] || '').toLowerCase();
    if (attrs.includes('type="application/json"') || attrs.includes("type='application/json'")) continue;
    blocks.push(match[2]);
  }
  return blocks;
}

function cleanTemplateMarkers(code) {
  return code
    .replace(/^\uFEFF/, '')
    .replace(/<\?!=?[\s\S]*?\?>/g, ' ')
    .replace(/<%[\s\S]*?%>/g, ' ');
}

function validateJavaScript(code, filename) {
  new vm.Script(code, { filename });
}

const failures = [];
const warnings = [];

for (const file of walk(ROOT)) {
  if (!TARGET_EXTENSIONS.some((ext) => file.endsWith(ext))) continue;

  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');

  try {
    if (file.endsWith('.gs') || file.endsWith('.js')) {
      validateJavaScript(cleanTemplateMarkers(text), rel);
      continue;
    }

    const scriptBlocks = extractScriptBlocks(text);
    if (!scriptBlocks.length) {
      warnings.push(`${rel}: no <script> blocks found; skipped embedded-JS parse.`);
      continue;
    }

    scriptBlocks.forEach((block, index) => {
      const cleaned = cleanTemplateMarkers(block);
      validateJavaScript(cleaned, `${rel}#script-${index + 1}`);
    });
  } catch (error) {
    failures.push(`${rel}: ${error?.message || String(error)}`);
  }
}

if (warnings.length) {
  console.log('Syntax validation warnings:');
  warnings.forEach((warning) => console.log(`- ${warning}`));
}

if (failures.length) {
  console.error('\nSyntax validation failures:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Syntax validation passed for .gs/.js and embedded HTML <script> blocks.');
