#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const requiredFiles = ['Code.gs', 'Index.html', 'appsscript.json'];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(repoRoot, file)));

if (missingFiles.length) {
  console.error(`Missing required files: ${missingFiles.join(', ')}`);
  process.exit(1);
}

console.log('Sanity check passed.');
