import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const behavioralTestDirs = ['tests/contracts', 'tests/smoke'];

function collectTestsInDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestsInDir(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      files.push(entryPath);
    }
  }

  return files;
}

export function collectBehavioralTestFiles(rootDir = repoRoot) {
  return behavioralTestDirs
    .flatMap((relativeDir) => collectTestsInDir(path.join(rootDir, relativeDir)))
    .sort();
}

function run() {
  const testFiles = collectBehavioralTestFiles();

  if (testFiles.length === 0) {
    console.error('No behavioral test files found under tests/contracts or tests/smoke.');
    process.exit(1);
  }

  const result = spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  process.exit(result.status ?? 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
