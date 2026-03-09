#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';

function getTrackedFiles() {
  const out = execSync('git ls-files', { encoding: 'utf8' });
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !p.startsWith('node_modules/'));
}

function findConflictMarkers(text) {
  const left = /^<<<<<<<(?: .*)?$/m.test(text);
  const mid = /^=======$/m.test(text);
  const right = /^>>>>>>> (?:.*)$/m.test(text);
  return left && mid && right;
}

const flagged = [];
for (const file of getTrackedFiles()) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (findConflictMarkers(content)) flagged.push(file);
  } catch {
    // Ignore non-text/unreadable files.
  }
}

if (flagged.length) {
  console.error('Merge conflict markers detected in:');
  flagged.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}

console.log('No merge conflict markers detected in tracked files.');
