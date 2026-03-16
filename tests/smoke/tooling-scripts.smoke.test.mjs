import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectBehavioralTestFiles } from '../../scripts/run-behavioral-tests.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

test('smoke: sanity script required files exist', () => {
  const requiredFiles = ['Code.gs', 'Index.html', 'appsscript.json'];

  for (const file of requiredFiles) {
    const fullPath = path.join(repoRoot, file);
    assert.doesNotThrow(() => fs.accessSync(fullPath, fs.constants.F_OK), `${file} should exist for sanity validation`);
  }
});

test('smoke: sanity-check script passes in the repo root', () => {
  const result = spawnSync(process.execPath, ['scripts/sanity-check.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `sanity-check should succeed, stderr: ${result.stderr}`);
  assert.match(result.stdout, /Sanity check passed\./);
});

test('smoke: behavioral test runner resolves concrete test files', () => {
  const files = collectBehavioralTestFiles(repoRoot);

  assert.ok(files.length > 0, 'expected at least one behavioral test file');
  assert.ok(files.every((file) => file.endsWith('.test.mjs')), 'expected only .test.mjs files');
  assert.ok(files.some((file) => file.includes(path.join('tests', 'contracts'))), 'expected contract tests');
  assert.ok(files.some((file) => file.includes(path.join('tests', 'smoke'))), 'expected smoke tests');
});

test('smoke: behavioral test runner script exits successfully', () => {
  const result = spawnSync(process.execPath, ['scripts/run-behavioral-tests.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `behavioral test runner should succeed, stderr: ${result.stderr}`);
});
