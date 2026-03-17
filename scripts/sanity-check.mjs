import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const requiredFiles = ['Code.gs', 'Index.html', 'appsscript.json'];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(repoRoot, file)));

if (missingFiles.length) {
  console.error(`Sanity check failed. Missing required files: ${missingFiles.join(', ')}`);
  process.exit(1);
}

console.log('Sanity check passed.');
