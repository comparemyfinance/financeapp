import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadNormalizeErrorMessage() {
  const html = fs.readFileSync('Index.html', 'utf8');
  const start = html.indexOf('normalizeErrorMessage(err, fallback) {');
  if (start === -1) throw new Error('normalizeErrorMessage helper not found');
  const bodyStart = html.indexOf('{', start);
  let i = bodyStart + 1;
  let depth = 1;
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    i += 1;
  }
  const fnSrc = 'function normalizeErrorMessage(err, fallback) ' + html.slice(bodyStart, i);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`${fnSrc}; this.normalizeErrorMessage = normalizeErrorMessage;`, ctx);
  return ctx.normalizeErrorMessage;
}

test('frontend error normalization uses backend error.message instead of [object Object]', () => {
  const normalizeErrorMessage = loadNormalizeErrorMessage();
  const msg = normalizeErrorMessage({
    success: false,
    ok: false,
    error: { code: 'CONFIG_ERROR', message: 'Missing required config: SPREADSHEET_ID' },
  }, 'Server error');
  assert.equal(msg, 'Missing required config: SPREADSHEET_ID');
});

test('frontend error normalization handles object fallbacks safely', () => {
  const normalizeErrorMessage = loadNormalizeErrorMessage();
  const msg = normalizeErrorMessage({ foo: 'bar' }, 'Server error');
  assert.equal(msg, '{"foo":"bar"}');
});
